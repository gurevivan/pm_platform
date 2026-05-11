from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0012_directorate_chat_attachments"),
    ]

    operations = [
        migrations.AddField(
            model_name="project",
            name="weekly_report_enabled",
            field=models.BooleanField(
                default=False,
                verbose_name="Еженедельный отчёт",
            ),
        ),
        migrations.AddField(
            model_name="workitem",
            name="weekly_report_enabled",
            field=models.BooleanField(
                default=False,
                verbose_name="Еженедельный отчёт",
            ),
        ),
    ]
