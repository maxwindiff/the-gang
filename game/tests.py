import json
import asyncio
from unittest.mock import AsyncMock, patch, MagicMock
from django.test import TestCase, TransactionTestCase
from channels.testing import WebsocketCommunicator
from channels.db import database_sync_to_async
from django.urls import reverse
from django.test.client import Client

from .consumers import GameConsumer
from .room_manager import room_manager, GameRoom, RoomState
from .poker_engine import PokerGame, Card, Suit, GameRound, ChipColor
from .poker_scoring import PokerHand, HandRank, find_best_hand, check_cooperative_win


class RoomManagerTestCase(TestCase):
    def setUp(self):
        room_manager.rooms.clear()

    def test_create_room(self):
        room = room_manager.create_room("test_room")
        self.assertEqual(room.name, "test_room")
        self.assertEqual(len(room.players), 0)
        self.assertEqual(room.state, RoomState.WAITING)
        self.assertIn("test_room", room_manager.rooms)

    def test_join_room_new_room(self):
        success, message = room_manager.join_room("new_room", "player1")
        self.assertTrue(success)
        self.assertIn("Successfully joined", message)
        
        room = room_manager.get_room("new_room")
        self.assertIsNotNone(room)
        self.assertIn("player1", room.players)

    def test_join_room_existing_room(self):
        room_manager.create_room("existing_room")
        success1, _ = room_manager.join_room("existing_room", "player1")
        success2, _ = room_manager.join_room("existing_room", "player2")
        
        self.assertTrue(success1)
        self.assertTrue(success2)
        
        room = room_manager.get_room("existing_room")
        self.assertEqual(len(room.players), 2)
        self.assertIn("player1", room.players)
        self.assertIn("player2", room.players)

    def test_join_room_duplicate_player(self):
        room_manager.create_room("test_room")
        room_manager.join_room("test_room", "player1")
        success, message = room_manager.join_room("test_room", "player1")
        
        self.assertFalse(success)
        self.assertIn("already in the room", message)

    def test_join_room_game_started(self):
        room = room_manager.create_room("started_room")
        room.state = RoomState.STARTED
        success, message = room_manager.join_room("started_room", "player1")
        
        self.assertFalse(success)
        self.assertIn("not accepting new players", message)

    def test_leave_room(self):
        room_manager.join_room("test_room", "player1")
        room_manager.join_room("test_room", "player2")
        
        success = room_manager.leave_room("test_room", "player1")
        self.assertTrue(success)
        
        room = room_manager.get_room("test_room")
        self.assertEqual(len(room.players), 1)
        self.assertNotIn("player1", room.players)
        self.assertIn("player2", room.players)

    def test_leave_room_last_player_deletes_room(self):
        room_manager.join_room("test_room", "player1")
        success = room_manager.leave_room("test_room", "player1")
        
        self.assertTrue(success)
        self.assertIsNone(room_manager.get_room("test_room"))

    def test_leave_nonexistent_room(self):
        success = room_manager.leave_room("nonexistent", "player1")
        self.assertFalse(success)


class GameRoomTestCase(TestCase):
    def setUp(self):
        self.room = GameRoom("test_room")

    def test_add_player_waiting_state(self):
        success = self.room.add_player("player1")
        self.assertTrue(success)
        self.assertIn("player1", self.room.players)

    def test_add_player_duplicate(self):
        self.room.add_player("player1")
        success = self.room.add_player("player1")
        self.assertFalse(success)
        self.assertEqual(len(self.room.players), 1)

    def test_add_player_game_started(self):
        self.room.state = RoomState.STARTED
        success = self.room.add_player("player1")
        self.assertFalse(success)

    def test_can_start_game(self):
        self.assertFalse(self.room.can_start_game())
        
        self.room.add_player("player1")
        self.room.add_player("player2")
        self.assertFalse(self.room.can_start_game())
        
        self.room.add_player("player3")
        self.assertTrue(self.room.can_start_game())
        
        for i in range(4, 7):
            self.room.add_player(f"player{i}")
        self.assertTrue(self.room.can_start_game())
        
        self.room.add_player("player7")
        self.assertFalse(self.room.can_start_game())

    def test_start_game(self):
        for i in range(1, 4):
            self.room.add_player(f"player{i}")
        
        success = self.room.start_game()
        self.assertTrue(success)
        self.assertEqual(self.room.state, RoomState.STARTED)
        self.assertIsNotNone(self.room.poker_game)

    def test_start_game_insufficient_players(self):
        self.room.add_player("player1")
        success = self.room.start_game()
        self.assertFalse(success)
        self.assertEqual(self.room.state, RoomState.WAITING)

    def test_end_game(self):
        for i in range(1, 4):
            self.room.add_player(f"player{i}")
        self.room.start_game()
        
        success = self.room.end_game()
        self.assertTrue(success)
        self.assertEqual(self.room.state, RoomState.WAITING)

    def test_restart_game(self):
        for i in range(1, 4):
            self.room.add_player(f"player{i}")
        self.room.start_game()
        self.room.end_game()
        
        success = self.room.restart_game()
        self.assertTrue(success)
        self.assertEqual(self.room.state, RoomState.STARTED)
        self.assertIsNotNone(self.room.poker_game)

    def test_to_dict_waiting_state(self):
        self.room.add_player("player1")
        data = self.room.to_dict()
        
        expected_keys = ['name', 'players', 'state', 'player_count', 'can_start']
        for key in expected_keys:
            self.assertIn(key, data)
        
        self.assertEqual(data['name'], 'test_room')
        self.assertEqual(data['players'], ['player1'])
        self.assertEqual(data['state'], 'waiting')
        self.assertEqual(data['player_count'], 1)
        self.assertFalse(data['can_start'])

    def test_to_dict_with_poker_game(self):
        for i in range(1, 4):
            self.room.add_player(f"player{i}")
        self.room.start_game()
        
        data = self.room.to_dict("player1")
        self.assertIn('poker_game', data)


class PokerEngineTestCase(TestCase):
    def setUp(self):
        self.players = ["player1", "player2", "player3"]
        self.game = PokerGame(self.players)

    def test_initialization(self):
        self.assertEqual(len(self.game.players), 3)
        self.assertEqual(self.game.current_round, GameRound.PREFLOP)
        self.assertEqual(len(self.game.community_cards), 0)
        
        for player in self.players:
            self.assertEqual(len(self.game.pocket_cards[player]), 2)
            for color in ChipColor:
                self.assertIsNone(self.game.player_chips[player][color])

    def test_preflop_setup(self):
        self.assertEqual(len(self.game.available_chips[ChipColor.WHITE]), 3)
        self.assertEqual(self.game.available_chips[ChipColor.WHITE], [1, 2, 3])

    def test_take_chip_from_public(self):
        success = self.game.take_chip_from_public("player1", 1)
        self.assertTrue(success)
        self.assertEqual(self.game.player_chips["player1"][ChipColor.WHITE], 1)
        self.assertNotIn(1, self.game.available_chips[ChipColor.WHITE])

    def test_take_chip_from_public_invalid_chip(self):
        success = self.game.take_chip_from_public("player1", 5)
        self.assertFalse(success)

    def test_take_chip_from_public_replace_existing(self):
        self.game.take_chip_from_public("player1", 1)
        success = self.game.take_chip_from_public("player1", 2)
        
        self.assertTrue(success)
        self.assertEqual(self.game.player_chips["player1"][ChipColor.WHITE], 2)
        self.assertIn(1, self.game.available_chips[ChipColor.WHITE])
        self.assertNotIn(2, self.game.available_chips[ChipColor.WHITE])

    def test_take_chip_from_player(self):
        self.game.take_chip_from_public("player1", 1)
        success = self.game.take_chip_from_player("player2", "player1")
        
        self.assertTrue(success)
        self.assertEqual(self.game.player_chips["player2"][ChipColor.WHITE], 1)
        self.assertIsNone(self.game.player_chips["player1"][ChipColor.WHITE])

    def test_take_chip_from_player_no_chip(self):
        success = self.game.take_chip_from_player("player2", "player1")
        self.assertFalse(success)

    def test_return_chip_to_public(self):
        self.game.take_chip_from_public("player1", 1)
        success = self.game.return_chip_to_public("player1")
        
        self.assertTrue(success)
        self.assertIsNone(self.game.player_chips["player1"][ChipColor.WHITE])
        self.assertIn(1, self.game.available_chips[ChipColor.WHITE])

    def test_all_players_have_chip(self):
        self.assertFalse(self.game.all_players_have_chip())
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        
        self.assertTrue(self.game.all_players_have_chip())

    def test_advance_to_flop(self):
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        
        success = self.game.advance_round()
        self.assertTrue(success)
        self.assertEqual(self.game.current_round, GameRound.FLOP)
        self.assertEqual(len(self.game.community_cards), 3)
        self.assertEqual(len(self.game.available_chips[ChipColor.YELLOW]), 3)

    def test_advance_to_turn(self):
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        
        self.game.advance_round()
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        
        success = self.game.advance_round()
        self.assertTrue(success)
        self.assertEqual(self.game.current_round, GameRound.TURN)
        self.assertEqual(len(self.game.community_cards), 4)

    def test_advance_to_river(self):
        self._advance_to_turn()
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        
        success = self.game.advance_round()
        self.assertTrue(success)
        self.assertEqual(self.game.current_round, GameRound.RIVER)
        self.assertEqual(len(self.game.community_cards), 5)

    def test_advance_to_scoring(self):
        self._advance_to_river()
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        
        success = self.game.advance_round()
        self.assertTrue(success)
        self.assertEqual(self.game.current_round, GameRound.SCORING)

    def test_cant_advance_without_chips(self):
        success = self.game.advance_round()
        self.assertFalse(success)

    def test_get_current_chip_color(self):
        self.assertEqual(self.game.get_current_chip_color(), ChipColor.WHITE)
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()
        self.assertEqual(self.game.get_current_chip_color(), ChipColor.YELLOW)
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()
        self.assertEqual(self.game.get_current_chip_color(), ChipColor.ORANGE)
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()
        self.assertEqual(self.game.get_current_chip_color(), ChipColor.RED)
        
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()
        self.assertIsNone(self.game.get_current_chip_color())

    def test_to_dict_perspective(self):
        data = self.game.to_dict("player1")
        
        self.assertEqual(len(data['pocket_cards']), 2)
        self.assertEqual(data['round'], 'preflop')
        self.assertEqual(data['players'], self.players)
        self.assertIn('chip_history', data)

    def test_to_dict_no_perspective(self):
        data = self.game.to_dict()
        self.assertEqual(len(data['pocket_cards']), 0)

    def test_chip_history_tracking(self):
        self.game.take_chip_from_public("player1", 1)
        self.game.take_chip_from_public("player2", 2)
        
        data = self.game.to_dict()
        chip_history = data['chip_history']
        
        self.assertEqual(chip_history['player1']['white'], 1)
        self.assertEqual(chip_history['player2']['white'], 2)
        self.assertNotIn('white', chip_history['player3'])

    def _advance_to_flop(self):
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()

    def _advance_to_turn(self):
        self._advance_to_flop()
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()

    def _advance_to_river(self):
        self._advance_to_turn()
        for i, player in enumerate(self.players):
            self.game.take_chip_from_public(player, i + 1)
        self.game.advance_round()


class APIViewTestCase(TestCase):
    def setUp(self):
        self.client = Client()
        room_manager.rooms.clear()

    def test_join_room_api(self):
        response = self.client.post('/api/join-room/', 
            data=json.dumps({
                'room_name': 'testroom',
                'player_name': 'testplayer'
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data['success'])
        self.assertIn('Successfully joined', data['message'])

    def test_join_room_api_missing_data(self):
        response = self.client.post('/api/join-room/', 
            data=json.dumps({
                'room_name': 'testroom'
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)

    def test_join_room_api_duplicate_player(self):
        room_manager.join_room('testroom', 'testplayer')
        
        response = self.client.post('/api/join-room/', 
            data=json.dumps({
                'room_name': 'testroom',
                'player_name': 'testplayer'
            }),
            content_type='application/json'
        )
        
        self.assertEqual(response.status_code, 400)
        data = response.json()
        self.assertIn('error', data)


class WebSocketConsumerTestCase(TestCase):
    def setUp(self):
        room_manager.rooms.clear()

    def test_consumer_message_handlers(self):
        consumer = GameConsumer()
        consumer.room_name = 'test_room'
        consumer.player_name = 'player1'
        
        for i in range(1, 4):
            room_manager.join_room('test_room', f'player{i}')
        
        room = room_manager.get_room('test_room')
        room.start_game()
        
        success = room.poker_game.take_chip_from_public('player1', 1)
        self.assertTrue(success)
        
        success = room.poker_game.return_chip_to_public('player1')
        self.assertTrue(success)
        
        success = room.poker_game.take_chip_from_public('player2', 2)
        success = room.poker_game.take_chip_from_player('player1', 'player2')
        self.assertTrue(success)


class CardTestCase(TestCase):
    def test_card_creation(self):
        card = Card(14, Suit.HEARTS)
        self.assertEqual(card.rank, 14)
        self.assertEqual(card.suit, Suit.HEARTS)

    def test_card_to_dict(self):
        card = Card(14, Suit.HEARTS)
        data = card.to_dict()
        
        self.assertEqual(data['rank'], 14)
        self.assertEqual(data['rank_str'], 'A')
        self.assertEqual(data['suit'], 'hearts')

    def test_card_str_representation(self):
        ace = Card(14, Suit.HEARTS)
        self.assertEqual(str(ace), 'AH')
        
        king = Card(13, Suit.SPADES)
        self.assertEqual(str(king), 'KS')
        
        number = Card(7, Suit.DIAMONDS)
        self.assertEqual(str(number), '7D')


class IntegrationTestCase(TestCase):
    def setUp(self):
        room_manager.rooms.clear()

    def test_complete_game_flow(self):
        players = ['alice', 'bob', 'charlie']
        
        for player in players:
            success, _ = room_manager.join_room('integration_test', player)
            self.assertTrue(success)
        
        room = room_manager.get_room('integration_test')
        self.assertTrue(room.can_start_game())
        
        success = room.start_game()
        self.assertTrue(success)
        self.assertEqual(room.state, RoomState.STARTED)
        
        game = room.poker_game
        self.assertEqual(game.current_round, GameRound.PREFLOP)
        
        for i, player in enumerate(players):
            success = game.take_chip_from_public(player, i + 1)
            self.assertTrue(success)
        
        self.assertTrue(game.can_advance_round())
        success = game.advance_round()
        self.assertTrue(success)
        self.assertEqual(game.current_round, GameRound.FLOP)
        self.assertEqual(len(game.community_cards), 3)
        
        for i, player in enumerate(players):
            success = game.take_chip_from_public(player, i + 1)
            self.assertTrue(success)
        
        success = game.advance_round()
        self.assertTrue(success)
        self.assertEqual(game.current_round, GameRound.TURN)
        self.assertEqual(len(game.community_cards), 4)
        
        for i, player in enumerate(players):
            success = game.take_chip_from_public(player, i + 1)
            self.assertTrue(success)
        
        success = game.advance_round()
        self.assertTrue(success)
        self.assertEqual(game.current_round, GameRound.RIVER)
        self.assertEqual(len(game.community_cards), 5)
        
        for i, player in enumerate(players):
            success = game.take_chip_from_public(player, i + 1)
            self.assertTrue(success)
        
        success = game.advance_round()
        self.assertTrue(success)
        self.assertEqual(game.current_round, GameRound.SCORING)
        
        data = game.to_dict('alice')
        self.assertIn('chip_history', data)
        chip_history = data['chip_history']
        for player in players:
            self.assertIn(player, chip_history)
            for color in ['white', 'yellow', 'orange', 'red']:
                self.assertIn(color, chip_history[player])

    def test_chip_stealing_scenario(self):
        players = ['alice', 'bob', 'charlie']
        
        for player in players:
            room_manager.join_room('steal_test', player)
        
        room = room_manager.get_room('steal_test')
        room.start_game()
        game = room.poker_game
        
        game.take_chip_from_public('alice', 1)
        game.take_chip_from_public('bob', 2)
        
        success = game.take_chip_from_player('charlie', 'alice')
        self.assertTrue(success)
        self.assertEqual(game.player_chips['charlie'][ChipColor.WHITE], 1)
        self.assertIsNone(game.player_chips['alice'][ChipColor.WHITE])
        
        game.take_chip_from_public('alice', 3)
        
        self.assertTrue(game.all_players_have_chip())

    def test_room_cleanup_on_empty(self):
        room_manager.join_room('cleanup_test', 'solo_player')
        self.assertIsNotNone(room_manager.get_room('cleanup_test'))
        
        success = room_manager.leave_room('cleanup_test', 'solo_player')
        self.assertTrue(success)
        self.assertIsNone(room_manager.get_room('cleanup_test'))

    def test_game_restart_flow(self):
        players = ['alice', 'bob', 'charlie']
        
        for player in players:
            room_manager.join_room('restart_test', player)
        
        room = room_manager.get_room('restart_test')
        room.start_game()
        room.end_game()
        
        self.assertEqual(room.state, RoomState.WAITING)
        
        success = room.restart_game()
        self.assertTrue(success)
        self.assertEqual(room.state, RoomState.STARTED)
        self.assertIsNotNone(room.poker_game)
        self.assertEqual(room.poker_game.current_round, GameRound.PREFLOP)

    def test_restart_game_from_scoring(self):
        players = ['alice', 'bob', 'charlie']
        
        for player in players:
            room_manager.join_room('scoring_restart_test', player)
        
        room = room_manager.get_room('scoring_restart_test')
        room.start_game()
        
        # Advance game to scoring phase
        for player in players:
            room.poker_game.player_chips[player][ChipColor.WHITE] = 1
            room.poker_game.player_chips[player][ChipColor.YELLOW] = 1
            room.poker_game.player_chips[player][ChipColor.ORANGE] = 1
        
        room.poker_game.advance_round()  # To flop
        room.poker_game.advance_round()  # To turn  
        room.poker_game.advance_round()  # To river
        
        for i, player in enumerate(players):
            room.poker_game.player_chips[player][ChipColor.RED] = i + 1
        
        room.poker_game.advance_round()  # To scoring
        
        # Verify we're in scoring phase
        self.assertEqual(room.poker_game.current_round, GameRound.SCORING)
        self.assertEqual(room.state, RoomState.STARTED)
        
        # Test restart from scoring phase
        success = room.restart_game()
        self.assertTrue(success)
        self.assertEqual(room.state, RoomState.STARTED)
        self.assertIsNotNone(room.poker_game)
        self.assertEqual(room.poker_game.current_round, GameRound.PREFLOP)


class PokerScoringTestCase(TestCase):
    def test_royal_flush(self):
        royal_flush = [
            Card(14, Suit.HEARTS), Card(13, Suit.HEARTS), Card(12, Suit.HEARTS),
            Card(11, Suit.HEARTS), Card(10, Suit.HEARTS)
        ]
        hand = PokerHand(royal_flush)
        self.assertEqual(hand.rank, HandRank.ROYAL_FLUSH)

    def test_straight_flush(self):
        straight_flush = [
            Card(9, Suit.SPADES), Card(8, Suit.SPADES), Card(7, Suit.SPADES),
            Card(6, Suit.SPADES), Card(5, Suit.SPADES)
        ]
        hand = PokerHand(straight_flush)
        self.assertEqual(hand.rank, HandRank.STRAIGHT_FLUSH)

    def test_four_of_a_kind(self):
        four_kind = [
            Card(7, Suit.HEARTS), Card(7, Suit.DIAMONDS), Card(7, Suit.CLUBS),
            Card(7, Suit.SPADES), Card(2, Suit.HEARTS)
        ]
        hand = PokerHand(four_kind)
        self.assertEqual(hand.rank, HandRank.FOUR_OF_A_KIND)

    def test_full_house(self):
        full_house = [
            Card(9, Suit.HEARTS), Card(9, Suit.DIAMONDS), Card(9, Suit.CLUBS),
            Card(4, Suit.SPADES), Card(4, Suit.HEARTS)
        ]
        hand = PokerHand(full_house)
        self.assertEqual(hand.rank, HandRank.FULL_HOUSE)

    def test_flush(self):
        flush = [
            Card(12, Suit.DIAMONDS), Card(9, Suit.DIAMONDS), Card(7, Suit.DIAMONDS),
            Card(5, Suit.DIAMONDS), Card(3, Suit.DIAMONDS)
        ]
        hand = PokerHand(flush)
        self.assertEqual(hand.rank, HandRank.FLUSH)

    def test_straight(self):
        straight = [
            Card(10, Suit.HEARTS), Card(9, Suit.DIAMONDS), Card(8, Suit.CLUBS),
            Card(7, Suit.SPADES), Card(6, Suit.HEARTS)
        ]
        hand = PokerHand(straight)
        self.assertEqual(hand.rank, HandRank.STRAIGHT)

    def test_wheel_straight(self):
        wheel = [
            Card(14, Suit.HEARTS), Card(2, Suit.DIAMONDS), Card(3, Suit.CLUBS),
            Card(4, Suit.SPADES), Card(5, Suit.HEARTS)
        ]
        hand = PokerHand(wheel)
        self.assertEqual(hand.rank, HandRank.STRAIGHT)

    def test_three_of_a_kind(self):
        three_kind = [
            Card(8, Suit.HEARTS), Card(8, Suit.DIAMONDS), Card(8, Suit.CLUBS),
            Card(5, Suit.SPADES), Card(3, Suit.HEARTS)
        ]
        hand = PokerHand(three_kind)
        self.assertEqual(hand.rank, HandRank.THREE_OF_A_KIND)

    def test_two_pair(self):
        two_pair = [
            Card(9, Suit.HEARTS), Card(9, Suit.DIAMONDS), Card(6, Suit.CLUBS),
            Card(6, Suit.SPADES), Card(3, Suit.HEARTS)
        ]
        hand = PokerHand(two_pair)
        self.assertEqual(hand.rank, HandRank.TWO_PAIR)

    def test_one_pair(self):
        one_pair = [
            Card(10, Suit.HEARTS), Card(10, Suit.DIAMONDS), Card(8, Suit.CLUBS),
            Card(5, Suit.SPADES), Card(2, Suit.HEARTS)
        ]
        hand = PokerHand(one_pair)
        self.assertEqual(hand.rank, HandRank.ONE_PAIR)

    def test_high_card(self):
        high_card = [
            Card(13, Suit.HEARTS), Card(11, Suit.DIAMONDS), Card(9, Suit.CLUBS),
            Card(6, Suit.SPADES), Card(2, Suit.HEARTS)
        ]
        hand = PokerHand(high_card)
        self.assertEqual(hand.rank, HandRank.HIGH_CARD)

    def test_best_hand_selection(self):
        seven_cards = [
            Card(14, Suit.HEARTS), Card(12, Suit.HEARTS), Card(9, Suit.HEARTS),
            Card(7, Suit.HEARTS), Card(5, Suit.HEARTS), Card(3, Suit.CLUBS), Card(2, Suit.DIAMONDS)
        ]
        best_hand = find_best_hand(seven_cards)
        self.assertEqual(best_hand.rank, HandRank.FLUSH)

    def test_hand_comparison(self):
        royal_flush = PokerHand([
            Card(14, Suit.HEARTS), Card(13, Suit.HEARTS), Card(12, Suit.HEARTS),
            Card(11, Suit.HEARTS), Card(10, Suit.HEARTS)
        ])
        
        pair_of_aces = PokerHand([
            Card(14, Suit.HEARTS), Card(14, Suit.DIAMONDS), Card(12, Suit.CLUBS),
            Card(7, Suit.SPADES), Card(3, Suit.HEARTS)
        ])
        
        self.assertTrue(royal_flush > pair_of_aces)
        self.assertFalse(pair_of_aces > royal_flush)

    def test_cooperative_scoring_win(self):
        players = ['alice', 'bob', 'charlie']
        
        # Create hands: alice weakest, bob strongest
        alice_hand = PokerHand([Card(7, Suit.HEARTS), Card(7, Suit.DIAMONDS), Card(12, Suit.CLUBS), Card(5, Suit.SPADES), Card(3, Suit.HEARTS)])
        bob_hand = PokerHand([Card(14, Suit.HEARTS), Card(14, Suit.DIAMONDS), Card(12, Suit.CLUBS), Card(7, Suit.SPADES), Card(3, Suit.HEARTS)]) 
        charlie_hand = PokerHand([Card(10, Suit.HEARTS), Card(10, Suit.DIAMONDS), Card(12, Suit.CLUBS), Card(7, Suit.SPADES), Card(3, Suit.HEARTS)])
        
        player_hands = {'alice': alice_hand, 'bob': bob_hand, 'charlie': charlie_hand}
        red_chips = {'alice': 1, 'charlie': 2, 'bob': 3}  # Correct assignment
        
        win, ranked_players, chip_assignments = check_cooperative_win(player_hands, red_chips)
        self.assertTrue(win)

    def test_cooperative_scoring_loss(self):
        players = ['alice', 'bob', 'charlie']
        
        alice_hand = PokerHand([Card(7, Suit.HEARTS), Card(7, Suit.DIAMONDS), Card(12, Suit.CLUBS), Card(5, Suit.SPADES), Card(3, Suit.HEARTS)])
        bob_hand = PokerHand([Card(14, Suit.HEARTS), Card(14, Suit.DIAMONDS), Card(12, Suit.CLUBS), Card(7, Suit.SPADES), Card(3, Suit.HEARTS)]) 
        charlie_hand = PokerHand([Card(10, Suit.HEARTS), Card(10, Suit.DIAMONDS), Card(12, Suit.CLUBS), Card(7, Suit.SPADES), Card(3, Suit.HEARTS)])
        
        player_hands = {'alice': alice_hand, 'bob': bob_hand, 'charlie': charlie_hand}
        red_chips = {'alice': 3, 'charlie': 1, 'bob': 2}  # Wrong assignment
        
        win, ranked_players, chip_assignments = check_cooperative_win(player_hands, red_chips)
        self.assertFalse(win)

    def test_scoring_integration(self):
        players = ['alice', 'bob', 'charlie']
        game = PokerGame(players)
        
        # Set up hands and advance to river
        for player in players:
            game.player_chips[player][ChipColor.WHITE] = 1
            game.player_chips[player][ChipColor.YELLOW] = 1
            game.player_chips[player][ChipColor.ORANGE] = 1
        
        game.advance_round()  # To flop
        game.advance_round()  # To turn  
        game.advance_round()  # To river
        
        # Assign red chips
        game.player_chips['alice'][ChipColor.RED] = 1
        game.player_chips['bob'][ChipColor.RED] = 2
        game.player_chips['charlie'][ChipColor.RED] = 3
        
        # Advance to scoring
        success = game.advance_round()
        
        self.assertTrue(success)
        self.assertEqual(game.current_round, GameRound.SCORING)
        self.assertIsNotNone(game.scoring_results)
        self.assertIn('win', game.scoring_results)
        self.assertIn('player_hands', game.scoring_results)
        self.assertIn('ranked_players', game.scoring_results)