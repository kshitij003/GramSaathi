from django.urls import path
from . import views

app_name = 'audio'
 
urlpatterns = [
    path('transcribe/', views.transcribe_audio, name='transcribe_audio'),
] 