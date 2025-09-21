from django.urls import path
from . import views

urlpatterns = [
    path('api/join-room/', views.join_room, name='join_room'),
    path('api/room-status/<str:room_name>/', views.room_status, name='room_status'),
]