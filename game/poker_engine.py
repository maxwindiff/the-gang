import random
from enum import Enum
from typing import Dict, List, Optional, Tuple
import logging
from .poker_scoring import find_best_hand, check_cooperative_win, format_hand_for_display

logger = logging.getLogger(__name__)

class Suit(Enum):
    HEARTS = "hearts"
    DIAMONDS = "diamonds" 
    CLUBS = "clubs"
    SPADES = "spades"

class GameRound(Enum):
    PREFLOP = "preflop"
    FLOP = "flop"
    TURN = "turn"
    RIVER = "river"
    SCORING = "scoring"

class Card:
    def __init__(self, rank: int, suit: Suit):
        self.rank = rank  # 2-14 (2-10, J=11, Q=12, K=13, A=14)
        self.suit = suit
    
    def to_dict(self) -> Dict:
        rank_names = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'}
        rank_str = rank_names.get(self.rank, str(self.rank))
        return {
            'rank': self.rank,
            'rank_str': rank_str,
            'suit': self.suit.value
        }
    
    def __str__(self):
        rank_names = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'}
        rank_str = rank_names.get(self.rank, str(self.rank))
        return f"{rank_str}{self.suit.value[0].upper()}"

class Deck:
    def __init__(self):
        self.cards = []
        self.reset()
    
    def reset(self):
        self.cards = []
        for suit in Suit:
            for rank in range(2, 15):  # 2 through Ace
                self.cards.append(Card(rank, suit))
        self.shuffle()
    
    def shuffle(self):
        random.shuffle(self.cards)
    
    def deal(self) -> Optional[Card]:
        return self.cards.pop() if self.cards else None

class ChipColor(Enum):
    WHITE = "white"
    YELLOW = "yellow"
    ORANGE = "orange"
    RED = "red"

class PokerGame:
    def __init__(self, players: List[str]):
        self.players = players
        self.num_players = len(players)
        self.deck = Deck()
        self.current_round = GameRound.PREFLOP
        
        # Game state
        self.pocket_cards: Dict[str, List[Card]] = {}
        self.community_cards: List[Card] = []
        
        # Chip management
        self.available_chips: Dict[ChipColor, List[int]] = {}
        self.player_chips: Dict[str, Dict[ChipColor, Optional[int]]] = {}
        
        # Scoring data
        self.scoring_results = None
        
        # Initialize player data
        for player in players:
            self.pocket_cards[player] = []
            self.player_chips[player] = {
                ChipColor.WHITE: None,
                ChipColor.YELLOW: None,
                ChipColor.ORANGE: None,
                ChipColor.RED: None
            }
        
        self.start_preflop()
    
    def start_preflop(self):
        """Start the pre-flop round"""
        self.current_round = GameRound.PREFLOP
        
        # Deal 2 cards to each player
        for player in self.players:
            self.pocket_cards[player] = [self.deck.deal(), self.deck.deal()]
        
        # Place white chips 1 to N in public area
        self.available_chips[ChipColor.WHITE] = list(range(1, self.num_players + 1))
        
        logger.info(f"Started pre-flop round with {self.num_players} players")
    
    def _advance_to_round(self, target_round: GameRound, expected_current: GameRound, 
                         chip_color: ChipColor, cards_to_deal: int = 0) -> bool:
        """Helper method to advance to a specific round"""
        if self.current_round != expected_current:
            return False
        
        self.current_round = target_round
        
        # Deal community cards
        for _ in range(cards_to_deal):
            self.community_cards.append(self.deck.deal())
        
        # Place chips in public area
        self.available_chips[chip_color] = list(range(1, self.num_players + 1))
        
        logger.info(f"Started {target_round.value} round, total community cards: {len(self.community_cards)}")
        return True

    def start_flop(self):
        """Start the flop round"""
        # Deal 3 community cards initially
        if self.current_round == GameRound.PREFLOP:
            self.community_cards = [self.deck.deal(), self.deck.deal(), self.deck.deal()]
        return self._advance_to_round(GameRound.FLOP, GameRound.PREFLOP, ChipColor.YELLOW, 0)
    
    def start_turn(self):
        """Start the turn round"""
        return self._advance_to_round(GameRound.TURN, GameRound.FLOP, ChipColor.ORANGE, 1)
    
    def start_river(self):
        """Start the river round"""
        return self._advance_to_round(GameRound.RIVER, GameRound.TURN, ChipColor.RED, 1)
    
    def get_current_chip_color(self) -> Optional[ChipColor]:
        """Get the chip color for the current round"""
        chip_map = {
            GameRound.PREFLOP: ChipColor.WHITE,
            GameRound.FLOP: ChipColor.YELLOW,
            GameRound.TURN: ChipColor.ORANGE,
            GameRound.RIVER: ChipColor.RED
        }
        return chip_map.get(self.current_round)
    
    def _return_player_chip_to_public(self, player: str, chip_color: ChipColor) -> Optional[int]:
        """Helper to return a player's current chip to public area"""
        current_chip = self.player_chips[player][chip_color]
        if current_chip is not None:
            self.available_chips[chip_color].append(current_chip)
            self.player_chips[player][chip_color] = None
        return current_chip

    def _assign_chip_to_player(self, player: str, chip_color: ChipColor, chip_number: int):
        """Helper to assign a chip to a player"""
        self.player_chips[player][chip_color] = chip_number

    def take_chip_from_public(self, player: str, chip_number: int) -> bool:
        """Player takes a chip from the public area"""
        chip_color = self.get_current_chip_color()
        if not chip_color or chip_number not in self.available_chips[chip_color]:
            return False
        
        # Return current chip to public if player has one
        self._return_player_chip_to_public(player, chip_color)
        
        # Take new chip
        self.available_chips[chip_color].remove(chip_number)
        self._assign_chip_to_player(player, chip_color, chip_number)
        
        logger.info(f"{player} took {chip_color.value} chip {chip_number}")
        return True
    
    def take_chip_from_player(self, taking_player: str, target_player: str) -> bool:
        """Player takes a chip from another player"""
        chip_color = self.get_current_chip_color()
        if not chip_color:
            return False
        
        target_chip = self.player_chips[target_player][chip_color]
        if target_chip is None:
            return False
        
        # Return taking player's current chip to public if they have one
        self._return_player_chip_to_public(taking_player, chip_color)
        
        # Transfer chip
        self.player_chips[target_player][chip_color] = None
        self._assign_chip_to_player(taking_player, chip_color, target_chip)
        
        logger.info(f"{taking_player} took {chip_color.value} chip {target_chip} from {target_player}")
        return True
    
    def return_chip_to_public(self, player: str) -> bool:
        """Player returns their chip to the public area"""
        chip_color = self.get_current_chip_color()
        if not chip_color:
            return False
        
        returned_chip = self._return_player_chip_to_public(player, chip_color)
        if returned_chip is None:
            return False
        
        logger.info(f"{player} returned {chip_color.value} chip {returned_chip} to public")
        return True
    
    def all_players_have_chip(self) -> bool:
        """Check if all players have a chip for the current round"""
        chip_color = self.get_current_chip_color()
        if not chip_color:
            return False
        
        for player in self.players:
            if self.player_chips[player][chip_color] is None:
                return False
        return True
    
    def can_advance_round(self) -> bool:
        """Check if the round can be advanced"""
        return self.all_players_have_chip()
    
    def advance_round(self) -> bool:
        """Advance to the next round"""
        if not self.can_advance_round():
            return False
        
        if self.current_round == GameRound.PREFLOP:
            return self.start_flop()
        elif self.current_round == GameRound.FLOP:
            return self.start_turn()
        elif self.current_round == GameRound.TURN:
            return self.start_river()
        elif self.current_round == GameRound.RIVER:
            self.current_round = GameRound.SCORING
            self._calculate_scoring()
            logger.info("Advanced to scoring phase")
            return True
        
        return False
    
    def _calculate_scoring(self):
        """Calculate scoring results for the game"""
        if len(self.community_cards) != 5:
            logger.error("Cannot calculate scoring without 5 community cards")
            return
        
        # Find best hand for each player
        player_hands = {}
        for player in self.players:
            all_cards = self.pocket_cards[player] + self.community_cards
            best_hand = find_best_hand(all_cards)
            player_hands[player] = best_hand
            logger.info(f"{player}'s best hand: {best_hand}")
        
        # Get red chip assignments
        red_chips = {}
        for player in self.players:
            red_chip = self.player_chips[player][ChipColor.RED]
            if red_chip is not None:
                red_chips[player] = red_chip
        
        # Check cooperative win condition
        win_status, ranked_players, chip_assignments = check_cooperative_win(player_hands, red_chips)
        
        # Store scoring results with all cards for each player
        player_all_cards = {}
        for player in self.players:
            all_cards = self.pocket_cards[player] + self.community_cards
            player_all_cards[player] = {
                'pocket_cards': [card.to_dict() for card in self.pocket_cards[player]],
                'community_cards': [card.to_dict() for card in self.community_cards],
                'all_cards': [card.to_dict() for card in all_cards],
                'best_hand': format_hand_for_display(player_hands[player])
            }
        
        self.scoring_results = {
            'win': win_status,
            'player_hands': {player: format_hand_for_display(hand) for player, hand in player_hands.items()},
            'player_all_cards': player_all_cards,
            'ranked_players': [(player, format_hand_for_display(hand)) for player, hand in ranked_players],
            'red_chip_assignments': chip_assignments
        }
        
        logger.info(f"Scoring complete: {'WIN' if win_status else 'LOSS'}")
    
    def to_dict(self, player_perspective: Optional[str] = None) -> Dict:
        """Convert game state to dictionary for JSON serialization"""
        # Community cards visible to all
        community_cards_data = [card.to_dict() for card in self.community_cards]
        
        # Player's pocket cards (only visible to them)
        pocket_cards_data = []
        if player_perspective and player_perspective in self.pocket_cards:
            pocket_cards_data = [card.to_dict() for card in self.pocket_cards[player_perspective]]
        
        # Current round chip state
        chip_color = self.get_current_chip_color()
        current_chips = {}
        available_chips = []
        
        if chip_color:
            # Player chips for current round
            for player in self.players:
                chip_num = self.player_chips[player][chip_color]
                if chip_num is not None:
                    current_chips[player] = chip_num
            
            # Available chips in public area
            available_chips = sorted(self.available_chips[chip_color])
        
        # Complete chip history for all players (visible to everyone)
        chip_history = {}
        for player in self.players:
            chip_history[player] = {}
            for color in ChipColor:
                chip_num = self.player_chips[player][color]
                if chip_num is not None:
                    chip_history[player][color.value] = chip_num
        
        result = {
            'round': self.current_round.value,
            'players': self.players,
            'community_cards': community_cards_data,
            'pocket_cards': pocket_cards_data,
            'current_chip_color': chip_color.value if chip_color else None,
            'player_chips': current_chips,
            'available_chips': available_chips,
            'chip_history': chip_history,
            'all_players_have_chip': self.all_players_have_chip(),
            'can_advance': self.can_advance_round()
        }
        
        # Add scoring results if in scoring phase
        if self.current_round == GameRound.SCORING and self.scoring_results:
            result['scoring'] = self.scoring_results
        
        return result