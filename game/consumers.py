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
        
        # Send initial room state to this player
        if room:
            if room.state == RoomState.STARTED:
                # If game is already started, send game_update with full state
                await self.send(text_data=json.dumps({
                    'type': 'game_update',
                    'room_data': room.to_dict(self.player_name)
                }))
            else:
                await self.send_room_update(room)
            # Only broadcast room_update if not in active game
            if room.state != RoomState.STARTED:
                # Broadcast updated room state to all other players
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'room_update',
                        'room_data': room.to_dict()
                    }
                )

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

        # Only remove player from room if they explicitly left (close_code 1000)
        # Don't remove on navigation (1001) or network disconnects, browser refreshes, etc.
        if close_code == 1000:
            success = room_manager.leave_room(self.room_name, self.player_name)
            if success:
                room = room_manager.get_room(self.room_name)
                if room:
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'room_update',
                            'room_data': room.to_dict()
                        }
                    )

        logger.info(f"WebSocket disconnected: {self.player_name} from {self.room_name} (code: {close_code})")

    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
            message_type = data.get('type')

            if message_type == 'start_game':
                await self.handle_start_game()
            elif message_type == 'end_game':
                await self.handle_end_game()
            elif message_type == 'restart_game':
                await self.handle_restart_game()
            elif message_type == 'leave_room':
                await self.handle_leave_room()
            elif message_type == 'take_chip_public':
                await self.handle_take_chip_public(data)
            elif message_type == 'take_chip_player':
                await self.handle_take_chip_player(data)
            elif message_type == 'return_chip':
                await self.handle_return_chip()
            elif message_type == 'advance_round':
                await self.handle_advance_round()
        except Exception as e:
            logger.error(f"Error handling message: {e}")
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid message format'
            }))

    async def handle_start_game(self):
        room = room_manager.get_room(self.room_name)
        if room and room.can_start_game():
            room.start_game()
            # Send personalized game_started message to each player
            for player in room.players:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_started',
                        'room_data': room.to_dict(player),
                        'target_player': player
                    }
                )

    async def handle_end_game(self):
        room = room_manager.get_room(self.room_name)
        if room and room.state == RoomState.STARTED:
            room.end_game()
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_ended',
                    'room_data': room.to_dict()
                }
            )

    async def handle_restart_game(self):
        room = room_manager.get_room(self.room_name)
        if room and room.state == RoomState.INTERMISSION:
            room.restart_game()
            # Send personalized game_started message to each player
            for player in room.players:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_started',
                        'room_data': room.to_dict(player),
                        'target_player': player
                    }
                )

    async def handle_leave_room(self):
        success = room_manager.leave_room(self.room_name, self.player_name)
        if success:
            room = room_manager.get_room(self.room_name)
            if room:
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'room_update',
                        'room_data': room.to_dict()
                    }
                )
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

    async def broadcast_game_update(self, room):
        """Broadcast game state to all players with their perspective"""
        for player in room.players:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_update',
                    'room_data': room.to_dict(player),
                    'target_player': player
                }
            )

    async def send_room_update(self, room):
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'room_data': room.to_dict(self.player_name)
        }))

    async def room_update(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_update',
            'room_data': event['room_data']
        }))

    async def game_update(self, event):
        # Only send to the intended player
        if event.get('target_player') == self.player_name:
            await self.send(text_data=json.dumps({
                'type': 'game_update',
                'room_data': event['room_data']
            }))

    async def game_started(self, event):
        # Only send to the intended player
        if event.get('target_player') == self.player_name:
            await self.send(text_data=json.dumps({
                'type': 'game_started',
                'room_data': event['room_data']
            }))

    async def game_ended(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_ended',
            'room_data': event['room_data']
        }))