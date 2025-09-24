from django.core.management.base import BaseCommand
from game.room_manager import room_manager
import logging

logger = logging.getLogger(__name__)

class Command(BaseCommand):
    help = 'Clean up stale game rooms with no connected players'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be cleaned up without actually doing it',
        )

    def handle(self, *args, **options):
        if options['dry_run']:
            self.stdout.write("DRY RUN: No rooms will actually be deleted")
            
        rooms_before = len(room_manager.rooms)
        self.stdout.write(f"Found {rooms_before} total rooms before cleanup")
        
        if options['dry_run']:
            # Show what would be cleaned up
            rooms_to_clean = 0
            current_time = __import__('time').time()
            
            for room_name, room in room_manager.rooms.items():
                if (not room.has_connected_players() and 
                    current_time - room.last_activity > 600):  # 10 minutes
                    rooms_to_clean += 1
                    self.stdout.write(
                        f"WOULD CLEAN: {room_name} "
                        f"(inactive for {int((current_time - room.last_activity) / 60)} minutes)"
                    )
            
            self.stdout.write(f"Would clean up {rooms_to_clean} stale rooms")
        else:
            cleaned_count = room_manager.cleanup_stale_rooms()
            self.stdout.write(f"Cleaned up {cleaned_count} stale rooms")
            
        rooms_after = len(room_manager.rooms)
        self.stdout.write(f"Found {rooms_after} total rooms after cleanup")
        
        if not options['dry_run'] and cleaned_count > 0:
            logger.info(f"Cleanup command removed {cleaned_count} stale rooms")