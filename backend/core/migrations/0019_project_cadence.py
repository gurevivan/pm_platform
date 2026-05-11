from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0018_disable_exclusive_themes"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="cadence",
            field=models.CharField(
                choices=[
                    ("infinite", "Бесконечный"),
                    ("weekly", "Еженедельный"),
                    ("monthly", "Ежемесячный"),
                ],
                default="infinite",
                max_length=12,
                verbose_name="Режим проекта",
            ),
        ),
    ]
