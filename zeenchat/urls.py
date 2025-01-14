from django.contrib import admin
from django.urls import path, include
import chatapp.urls
from chatapp.views import logout_view
from django.contrib.auth import views as auth_views

urlpatterns = [
    path('admin/', admin.site.urls),
    path('accounts/login/', auth_views.LoginView.as_view(template_name='chatapp/login.html'), name='login'),
    path('accounts/logout/', logout_view, name='logout'),
    path('', include('chatapp.urls')),
    path('ws/', include('chatapp.routing')),

]