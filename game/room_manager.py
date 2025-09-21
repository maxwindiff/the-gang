from enum import Enum
from typing import Dict, List, Optional
import logging
from .poker_engine import PokerGame

logger = logging.getLogger(__name__)

class RoomState(Enum):
    WAITING = "waiting"
    STARTED = "started"
    INTERMISSION = "intermission"

class GameRoom:
    def __init__(self, name: str):
        self.name = name
        self.players: List[str] = []
        self.state = RoomState.WAITING
        self.game_state = {}
        self.poker_game: Optional[PokerGame] = None

    def add_player(self, player_name: str) -> bool:
        if self.state != RoomState.WAITING:
            return False
        if player_name not in self.players:
            self.players.append(player_name)
            logger.info(f"Player {player_name} joined room {self.name}")
            return True
        return False

    def remove_player(self, player_name: str) -> bool:
        if player_name in self.players:
            self.players.remove(player_name)
            logger.info(f"Player {player_name} left room {self.name}")
            return True
        return False

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
            self.state = RoomState.INTERMISSION
            logger.info(f"Game ended in room {self.name}")
            return True
        return False

    def restart_game(self) -> bool:
        if self.state == RoomState.INTERMISSION and 3 <= len(self.players) <= 6:
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
            if success and len(room.players) == 0:
                del self.rooms[room_name]
                logger.info(f"Deleted empty room {room_name}")
            return success
        return False

room_manager = RoomManager()