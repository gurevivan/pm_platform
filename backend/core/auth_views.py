"""Регистрация пользователя (MVP)."""

from django.contrib.auth import get_user_model
from rest_framework import generics, permissions, serializers

from core.models import Directorate


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    directorate_id = serializers.PrimaryKeyRelatedField(
        queryset=Directorate.objects.filter(is_active=True),
        source="directorate",
        write_only=True,
        allow_null=True,
        required=False,
    )

    class Meta:
        model = get_user_model()
        fields = (
            "username",
            "password",
            "first_name",
            "last_name",
            "patronymic",
            "directorate_id",
            "job_title",
        )

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = get_user_model()(**validated_data)
        user.set_password(password)
        user.save()
        return user


class RegisterView(generics.CreateAPIView):
    queryset = get_user_model().objects.all()
    serializer_class = UserRegistrationSerializer
    permission_classes = [permissions.AllowAny]
