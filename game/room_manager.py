from enum import Enum
from typing import Dict, List, Optional, Set
import logging
import time
from .poker_engine import PokerGame

logger = logging.getLogger(__name__)

class RoomState(Enum):
    WAITING = "waiting"
    STARTED = "started"

class GameRoom:
    def __init__(self, name: str):
        self.name = name
        self.players: List[str] = []
        self.connected_players: Set[str] = set()
        self.state = RoomState.WAITING
        self.game_state = {}
        self.poker_game: Optional[PokerGame] = None
        self.last_activity = time.time()

    def add_player(self, player_name: str) -> bool:
        if self.state != RoomState.WAITING:
            return False
        if player_name not in self.players:
            self.players.append(player_name)
            self.last_activity = time.time()
            logger.info(f"Player {player_name} joined room {self.name}")
            return True
        return False

    def remove_player(self, player_name: str) -> bool:
        if player_name in self.players:
            self.players.remove(player_name)
            self.connected_players.discard(player_name)
            self.last_activity = time.time()
            logger.info(f"Player {player_name} left room {self.name}")
            return True
        return False

    def connect_player(self, player_name: str) -> None:
        if player_name in self.players:
            self.connected_players.add(player_name)
            self.last_activity = time.time()
            logger.info(f"Player {player_name} connected to room {self.name}")

    def disconnect_player(self, player_name: str) -> None:
        self.connected_players.discard(player_name)
        self.last_activity = time.time()
        logger.info(f"Player {player_name} disconnected from room {self.name}")

    def is_empty(self) -> bool:
        return len(self.players) == 0

    def has_connected_players(self) -> bool:
        return len(self.connected_players) > 0

    def can_start_game(self) -> bool:
        return self.state == RoomState.WAITING and 3 <= len(self.players) <= 6

    def start_game(self) -> bool:
        if self.can_start_game():
            self.state = RoomState.STARTED
            self.poker_game = PokerGame(self.players.copy())
            self.game_state = {}
            logger.info(f"Game started in room {self.name}")
            return True
        return False

    def end_game(self) -> bool:
        if self.state == RoomState.STARTED:
            self.state = RoomState.WAITING
            self.poker_game = None
            logger.info(f"Game ended in room {self.name}")
            return True
        return False

    def restart_game(self) -> bool:
        # Allow restart from scoring phase or when game has ended
        can_restart = (
            (self.state == RoomState.WAITING) or 
            (self.state == RoomState.STARTED and self.poker_game and 
             hasattr(self.poker_game, 'current_round') and 
             self.poker_game.current_round.value == 'scoring')
        ) and 3 <= len(self.players) <= 6
        
        if can_restart:
            self.state = RoomState.STARTED
            self.poker_game = PokerGame(self.players.copy())
            self.game_state = {}
            logger.info(f"Game restarted in room {self.name}")
            return True
        return False

    def to_dict(self, player_perspective: Optional[str] = None) -> Dict:
        base_data = {
            'name': self.name,
            'players': self.players,
            'state': self.state.value,
            'player_count': len(self.players),
            'can_start': self.can_start_game()
        }
        
        # Add poker game data if game is active
        if self.poker_game and self.state == RoomState.STARTED:
            base_data['poker_game'] = self.poker_game.to_dict(player_perspective)
        
        return base_data

class RoomManager:
    def __init__(self):
        self.rooms: Dict[str, GameRoom] = {}

    def create_room(self, room_name: str) -> GameRoom:
        if room_name not in self.rooms:
            self.rooms[room_name] = GameRoom(room_name)
            logger.info(f"Created room {room_name}")
        return self.rooms[room_name]

    def get_room(self, room_name: str) -> Optional[GameRoom]:
        return self.rooms.get(room_name)

    def join_room(self, room_name: str, player_name: str) -> tuple[bool, str]:
        room = self.get_room(room_name)
        if not room:
            room = self.create_room(room_name)
        
        if room.state != RoomState.WAITING:
            return False, f"Room {room_name} is not accepting new players"
        
        success = room.add_player(player_name)
        if success:
            return True, f"Successfully joined room {room_name}"
        else:
            return False, f"Player {player_name} is already in the room"

    def leave_room(self, room_name: str, player_name: str) -> bool:
        room = self.get_room(room_name)
        if room:
            success = room.remove_player(player_name)
            if success:
                self._cleanup_room_if_needed(room_name, room)
            return success
        return False

    def connect_to_room(self, room_name: str, player_name: str) -> bool:
        room = self.get_room(room_name)
        if room and player_name in room.players:
            room.connect_player(player_name)
            return True
        return False

    def disconnect_from_room(self, room_name: str, player_name: str) -> bool:
        room = self.get_room(room_name)
        if room:
            room.disconnect_player(player_name)
            self._cleanup_room_if_needed(room_name, room)
            return True
        return False

    def _cleanup_room_if_needed(self, room_name: str, room):
        # Clean up room if it's completely empty
        if room.is_empty():
            del self.rooms[room_name]
            logger.info(f"Deleted empty room {room_name}")
        # Or if no players are connected and room is in waiting state for more than 5 minutes
        elif (room.state == RoomState.WAITING and 
              not room.has_connected_players() and 
              time.time() - room.last_activity > 300):  # 5 minutes
            del self.rooms[room_name]
            logger.info(f"Deleted stale room {room_name} (no connected players for 5 minutes)")

    def cleanup_stale_rooms(self) -> int:
        """Clean up rooms with no connected players for extended periods"""
        rooms_to_delete = []
        current_time = time.time()
        
        for room_name, room in self.rooms.items():
            # Delete rooms with no connected players for more than 10 minutes
            if (not room.has_connected_players() and 
                current_time - room.last_activity > 600):  # 10 minutes
                rooms_to_delete.append(room_name)
        
        for room_name in rooms_to_delete:
            del self.rooms[room_name]
            logger.info(f"Cleaned up stale room {room_name}")
        
        return len(rooms_to_delete)

room_manager = RoomManager()