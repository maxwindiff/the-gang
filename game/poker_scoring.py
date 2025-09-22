from enum import Enum
from typing import List, Tuple, Dict
from collections import Counter
import itertools
import logging

logger = logging.getLogger(__name__)

class HandRank(Enum):
    HIGH_CARD = 1
    ONE_PAIR = 2
    TWO_PAIR = 3
    THREE_OF_A_KIND = 4
    STRAIGHT = 5
    FLUSH = 6
    FULL_HOUSE = 7
    FOUR_OF_A_KIND = 8
    STRAIGHT_FLUSH = 9
    ROYAL_FLUSH = 10

class PokerHand:
    def __init__(self, cards):
        self.cards = sorted(cards, key=lambda c: c.rank, reverse=True)
        self.rank, self.tie_breakers = self._evaluate_hand()
    
    def _evaluate_hand(self) -> Tuple[HandRank, List[int]]:
        ranks = [card.rank for card in self.cards]
        suits = [card.suit for card in self.cards]
        
        # Check for flush
        is_flush = len(set(suits)) == 1
        
        # Check for straight
        is_straight, straight_high = self._check_straight(ranks)
        
        # Count ranks
        rank_counts = Counter(ranks)
        count_values = sorted(rank_counts.values(), reverse=True)
        
        # Royal flush: A, K, Q, J, 10 all same suit
        if is_flush and is_straight and max(ranks) == 14 and min(ranks) == 10:
            return HandRank.ROYAL_FLUSH, [14]
        
        # Straight flush: Five cards in sequence, all same suit
        if is_flush and is_straight:
            return HandRank.STRAIGHT_FLUSH, [straight_high]
        
        # Four of a kind: Four cards of same rank
        if count_values == [4, 1]:
            four_rank = [rank for rank, count in rank_counts.items() if count == 4][0]
            kicker = [rank for rank, count in rank_counts.items() if count == 1][0]
            return HandRank.FOUR_OF_A_KIND, [four_rank, kicker]
        
        # Full house: Three cards of one rank, two of another
        if count_values == [3, 2]:
            three_rank = [rank for rank, count in rank_counts.items() if count == 3][0]
            pair_rank = [rank for rank, count in rank_counts.items() if count == 2][0]
            return HandRank.FULL_HOUSE, [three_rank, pair_rank]
        
        # Flush: Five cards of same suit, not in sequence
        if is_flush:
            return HandRank.FLUSH, sorted(ranks, reverse=True)
        
        # Straight: Five cards in sequence, not all same suit
        if is_straight:
            return HandRank.STRAIGHT, [straight_high]
        
        # Three of a kind: Three cards of same rank
        if count_values == [3, 1, 1]:
            three_rank = [rank for rank, count in rank_counts.items() if count == 3][0]
            kickers = sorted([rank for rank, count in rank_counts.items() if count == 1], reverse=True)
            return HandRank.THREE_OF_A_KIND, [three_rank] + kickers
        
        # Two pair: Two cards of one rank, two of another
        if count_values == [2, 2, 1]:
            pairs = sorted([rank for rank, count in rank_counts.items() if count == 2], reverse=True)
            kicker = [rank for rank, count in rank_counts.items() if count == 1][0]
            return HandRank.TWO_PAIR, pairs + [kicker]
        
        # One pair: Two cards of same rank
        if count_values == [2, 1, 1, 1]:
            pair_rank = [rank for rank, count in rank_counts.items() if count == 2][0]
            kickers = sorted([rank for rank, count in rank_counts.items() if count == 1], reverse=True)
            return HandRank.ONE_PAIR, [pair_rank] + kickers
        
        # High card: No matching cards
        return HandRank.HIGH_CARD, sorted(ranks, reverse=True)
    
    def _check_straight(self, ranks: List[int]) -> Tuple[bool, int]:
        unique_ranks = sorted(set(ranks), reverse=True)
        
        if len(unique_ranks) != 5:
            return False, 0
        
        # Check for regular straight
        if unique_ranks[0] - unique_ranks[4] == 4:
            return True, unique_ranks[0]
        
        # Check for A-2-3-4-5 straight (wheel)
        if unique_ranks == [14, 5, 4, 3, 2]:
            return True, 5  # In wheel straight, 5 is the high card
        
        return False, 0
    
    def __lt__(self, other):
        if self.rank.value != other.rank.value:
            return self.rank.value < other.rank.value
        
        # Compare tie breakers
        for my_val, other_val in zip(self.tie_breakers, other.tie_breakers):
            if my_val != other_val:
                return my_val < other_val
        
        return False  # Hands are tied
    
    def __eq__(self, other):
        return self.rank == other.rank and self.tie_breakers == other.tie_breakers
    
    def __str__(self):
        rank_names = {
            HandRank.HIGH_CARD: "High Card",
            HandRank.ONE_PAIR: "One Pair", 
            HandRank.TWO_PAIR: "Two Pair",
            HandRank.THREE_OF_A_KIND: "Three of a Kind",
            HandRank.STRAIGHT: "Straight",
            HandRank.FLUSH: "Flush",
            HandRank.FULL_HOUSE: "Full House",
            HandRank.FOUR_OF_A_KIND: "Four of a Kind",
            HandRank.STRAIGHT_FLUSH: "Straight Flush",
            HandRank.ROYAL_FLUSH: "Royal Flush"
        }
        return rank_names[self.rank]

def find_best_hand(cards):
    """
    Find the best 5-card poker hand from a list of 7 cards.
    Returns the best PokerHand object.
    """
    if len(cards) < 5:
        raise ValueError("Need at least 5 cards to make a poker hand")
    
    if len(cards) == 5:
        return PokerHand(cards)
    
    best_hand = None
    
    # Generate all 5-card combinations
    for combo in itertools.combinations(cards, 5):
        hand = PokerHand(list(combo))
        if best_hand is None or hand > best_hand:
            best_hand = hand
    
    return best_hand

def rank_players_by_hands(player_hands: Dict[str, PokerHand]) -> List[Tuple[str, PokerHand]]:
    """
    Rank players by their poker hands from weakest to strongest.
    Returns list of (player_name, hand) tuples in ascending order of hand strength.
    """
    return sorted(player_hands.items(), key=lambda x: x[1])

def check_cooperative_win(player_hands: Dict[str, PokerHand], red_chips: Dict[str, int]) -> Tuple[bool, List[Tuple[str, PokerHand]], Dict[str, int]]:
    """
    Check if players win cooperatively based on red chip assignments.
    
    Args:
        player_hands: Dict mapping player names to their best PokerHand
        red_chips: Dict mapping player names to their red chip numbers
    
    Returns:
        Tuple of (win_status, ranked_players, red_chip_assignments)
        - win_status: True if players win, False if they lose
        - ranked_players: List of (player, hand) tuples sorted by hand strength (weakest to strongest)
        - red_chip_assignments: Dict mapping player to their red chip number
    """
    # Rank players by hand strength (weakest to strongest)
    ranked_players = rank_players_by_hands(player_hands)
    
    # Check if red chips match the hand strength order
    win = True
    
    for i, (player, hand) in enumerate(ranked_players):
        expected_chip = i + 1  # Chip numbers are 1-indexed
        actual_chip = red_chips.get(player)
        
        if actual_chip is None:
            logger.error(f"Player {player} has no red chip assigned")
            win = False
            continue
        
        # Handle ties - players with tied hands can have their chips in any order
        tied_players = []
        for j, (other_player, other_hand) in enumerate(ranked_players):
            if hand == other_hand:
                tied_players.append((other_player, j + 1))
        
        if len(tied_players) > 1:
            # Multiple players tied - check if their chips are within the tied range
            tied_chip_positions = [pos for _, pos in tied_players]
            min_pos, max_pos = min(tied_chip_positions), max(tied_chip_positions)
            valid_chips = list(range(min_pos, max_pos + 1))
            
            if actual_chip not in valid_chips:
                logger.info(f"Player {player} has chip {actual_chip}, but should have one of {valid_chips} due to tie")
                win = False
        else:
            # No tie - chip must match exactly
            if actual_chip != expected_chip:
                logger.info(f"Player {player} has chip {actual_chip}, but should have chip {expected_chip}")
                win = False
    
    return win, ranked_players, red_chips

def format_hand_for_display(hand: PokerHand) -> Dict:
    """
    Format a poker hand for frontend display.
    """
    card_names = {11: 'J', 12: 'Q', 13: 'K', 14: 'A'}
    
    return {
        'rank': hand.rank.name,
        'rank_display': str(hand),
        'cards': [
            {
                'rank': card.rank,
                'rank_str': card_names.get(card.rank, str(card.rank)),
                'suit': card.suit.value
            }
            for card in hand.cards
        ],
        'tie_breakers': hand.tie_breakers
    }