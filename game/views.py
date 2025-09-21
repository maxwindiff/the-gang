from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
import json
import logging
from .room_manager import room_manager, RoomState

logger = logging.getLogger(__name__)

@csrf_exempt
@require_http_methods(["POST"])
def join_room(request):
    try:
        data = json.loads(request.body)
        room_name = data.get('room_name', '').strip()
        player_name = data.get('player_name', '').strip()
        
        if not room_name or not player_name:
            return JsonResponse({'error': 'Room name and player name are required'}, status=400)
        
        if not room_name.isalnum() or not player_name.isalnum():
            return JsonResponse({'error': 'Room name and player name must be alphanumeric'}, status=400)
        
        success, message = room_manager.join_room(room_name, player_name)
        
        if success:
            room = room_manager.get_room(room_name)
            return JsonResponse({
                'success': True,
                'message': message,
                'room_data': room.to_dict()
            })
        else:
            return JsonResponse({'error': message}, status=400)
            
    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON'}, status=400)
    except Exception as e:
        logger.error(f"Error in join_room: {e}")
        return JsonResponse({'error': 'Internal server error'}, status=500)

@require_http_methods(["GET"])
def room_status(request, room_name):
    try:
        room = room_manager.get_room(room_name)
        if room:
            return JsonResponse({
                'exists': True,
                'room_data': room.to_dict()
            })
        else:
            return JsonResponse({
                'exists': False
            })
    except Exception as e:
        logger.error(f"Error in room_status: {e}")
        return JsonResponse({'error': 'Internal server error'}, status=500)
