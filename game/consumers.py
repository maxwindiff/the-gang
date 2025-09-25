import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from .room_manager import room_manager, RoomState
import logging

logger = logging.getLogger(__name__)

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.player_name = self.scope['url_route']['kwargs']['player_name']
        self.room_group_name = f'game_{self.room_name}'

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        logger.info(f"WebSocket connected: {self.player_name} to {self.room_name}")

        # Ensure player is in the room (in case they joined via API before connecting WebSocket)
        room = room_manager.get_room(self.room_name)
        if room and self.player_name not in room.players:
            if room.state == RoomState.WAITING:
                room.add_player(self.player_name)
        
        # Mark player as connected
        room_manager.connect_to_room(self.room_name, self.player_name)
        
        # Send initial room state to this player
        if room:
            if room.state == RoomState.STARTED:
                await self._send_message('game_update', room.to_dict(self.player_name))
            else:
                await self.send_room_update(room)
            # Only broadcast room_update if not in active game
            if room.state != RoomState.STARTED:
                await self._broadcast_to_room('room_update', room.to_dict())

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Mark player as disconnected
        room_manager.disconnect_from_room(self.room_name, self.player_name)
        
        # Handle different disconnect scenarios more aggressively
        room = room_manager.get_room(self.room_name)
        should_remove_player = False
        
        if close_code == 1000:
            # Explicit close - always remove player
            should_remove_player = True
        elif close_code == 1001:
            # Navigation away - remove player if room is in waiting state
            if room and room.state == RoomState.WAITING:
                should_remove_player = True
        elif room and not room.has_connected_players():
            # If no other players are connected, remove this player too
            should_remove_player = True
            
        if should_remove_player:
            success = room_manager.leave_room(self.room_name, self.player_name)
            if success:
                room = room_manager.get_room(self.room_name)
                if room:
                    await self._broadcast_to_room('room_update', room.to_dict())

        logger.info(f"WebSocket disconnected: {self.player_name} from {self.room_name} (code: {close_code}, removed: {should_remove_player})")

    async def _send_error(self, message):
        await self.send(text_data=json.dumps({
            'type': 'error',
            'message': message
        }))

    async def _send_message(self, message_type, room_data=None, target_player=None):
        message = {'type': message_type}
        if room_data:
            message['room_data'] = room_data
        if target_player:
            message['target_player'] = target_player
        await self.send(text_data=json.dumps(message))

    async def _broadcast_to_room(self, message_type, room_data=None, target_player=None):
        message = {'type': message_type}
        if room_data:
            message['room_data'] = room_data
        if target_player:
            message['target_player'] = target_player
        await self.channel_layer.group_send(self.room_group_name, message)

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            handlers = {
                'start_game': self.handle_start_game,
                'end_game': self.handle_end_game,
                'restart_game': self.handle_restart_game,
                'leave_room': self.handle_leave_room,
                'take_chip_public': lambda: self.handle_take_chip_public(data),
                'take_chip_player': lambda: self.handle_take_chip_player(data),
                'return_chip': self.handle_return_chip,
                'advance_round': self.handle_advance_round,
                'ping': self.handle_ping,
                'dev_distribute_chips': self.handle_dev_distribute_chips,
            }
            
            handler = handlers.get(message_type)
            if handler:
                await handler()
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self._send_error('Invalid message format')

    async def handle_start_game(self):
        room = room_manager.get_room(self.room_name)
        if room and room.can_start_game():
            room.start_game()
            for player in room.players:
                await self._broadcast_to_room('game_started', room.to_dict(player), player)

    async def handle_end_game(self):
        room = room_manager.get_room(self.room_name)
        if room and room.state == RoomState.STARTED:
            room.end_game()
            await self._broadcast_to_room('game_ended', room.to_dict())

    async def handle_restart_game(self):
        room = room_manager.get_room(self.room_name)
        if room:
            success = room.restart_game()
            if success:
                for player in room.players:
                    await self._broadcast_to_room('game_started', room.to_dict(player), player)

    async def handle_leave_room(self):
        success = room_manager.leave_room(self.room_name, self.player_name)
        if success:
            room = room_manager.get_room(self.room_name)
            if room:
                await self._broadcast_to_room('room_update', room.to_dict())
            await self.close()

    async def handle_take_chip_public(self, data):
        room = room_manager.get_room(self.room_name)
        if room and room.poker_game:
            chip_number = data.get('chip_number')
            if chip_number is not None:
                success = room.poker_game.take_chip_from_public(self.player_name, chip_number)
                if success:
                    await self.broadcast_game_update(room)

    async def handle_take_chip_player(self, data):
        room = room_manager.get_room(self.room_name)
        if room and room.poker_game:
            target_player = data.get('target_player')
            if target_player:
                success = room.poker_game.take_chip_from_player(self.player_name, target_player)
                if success:
                    await self.broadcast_game_update(room)

    async def handle_return_chip(self):
        room = room_manager.get_room(self.room_name)
        if room and room.poker_game:
            success = room.poker_game.return_chip_to_public(self.player_name)
            if success:
                await self.broadcast_game_update(room)

    async def handle_advance_round(self):
        room = room_manager.get_room(self.room_name)
        if room and room.poker_game:
            if room.poker_game.can_advance_round():
                success = room.poker_game.advance_round()
                if success:
                    await self.broadcast_game_update(room)

    async def handle_ping(self):
        room_manager.connect_to_room(self.room_name, self.player_name)
        await self._send_message('pong')

    async def handle_dev_distribute_chips(self):
        """Dev helper: distribute chips to all players"""
        room = room_manager.get_room(self.room_name)
        if room and room.poker_game:
            current_chip_color = room.poker_game.get_current_chip_color()
            available_chips = room.poker_game.available_chips.get(current_chip_color, []).copy()
            players = room.players
            
            # Distribute chips to players in order
            for i, player in enumerate(players):
                if i < len(available_chips):
                    chip_number = available_chips[i]
                    success = room.poker_game.take_chip_from_public(player, chip_number)
                    if success:
                        logger.info(f"[DEV] Distributed {current_chip_color.value} chip {chip_number} to {player}")
                    else:
                        logger.warning(f"[DEV] Failed to distribute {current_chip_color.value} chip {chip_number} to {player}")
            
            await self.broadcast_game_update(room)

    async def broadcast_game_update(self, room):
        for player in room.players:
            await self._broadcast_to_room('game_update', room.to_dict(player), player)

    async def send_room_update(self, room):
        await self._send_message('room_update', room.to_dict(self.player_name))

    async def room_update(self, event):
        await self._send_message(event['type'], event.get('room_data'))

    async def game_update(self, event):
        if event.get('target_player') == self.player_name:
            await self._send_message(event['type'], event.get('room_data'))

    async def game_started(self, event):
        if event.get('target_player') == self.player_name:
            await self._send_message(event['type'], event.get('room_data'))

    async def game_ended(self, event):
        await self._send_message(event['type'], event.get('room_data'))