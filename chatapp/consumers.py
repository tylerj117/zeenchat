# chatapp/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer

class ChatConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Get usernames from URL
        user1 = self.scope['url_route']['kwargs']['user1']
        user2 = self.scope['url_route']['kwargs']['user2']
        
        # Sort users alphabetically to ensure consistent room name
        users = sorted([user1, user2])
        self.room_name = f"chat_{users[0]}_{users[1]}"
        self.room_group_name = self.room_name

        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        await self.accept()

    async def disconnect(self, close_code):
        # Leave room group
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # Receive message from WebSocket
    async def receive(self, text_data):
        text_data_json = json.loads(text_data)
        event_type = text_data_json.get("type") #Check the type of event

        if event_type == "message":
            message = text_data_json['message']
            sender = text_data_json['sender']     
        
            # Send message to room group
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'sender': sender
                }
            )
        
        elif event_type == "typing":
            username = text_data_json["username"]

            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_typing',
                    "username": username,
                }
            )
             
        elif event_type == "stopped_typing":
            username = text_data_json["username"]
        
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_stopped_typing',
                    'username': username,
                }
            )        

    #Outgoing Typing indicator functions

    async def user_typing(self, event):
        await self.send(text_data = json.dumps({
            'type':'typing',
            'username': event['username'],
        }))

    async def user_stopped_typing(self, event):
        await self.send(text_data = json.dumps({
            'type':'stopped_typing',
            'username': event['username'],
        }))

    # Receive message from room group
    async def chat_message(self, event):
        message = event['message']
        sender = event['sender']

        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'message': message,
            'sender': sender
        }))