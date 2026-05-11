from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0022_work_item_status_history"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectchatmessage",
            name="attachment",
            field=models.FileField(
                blank=True,
                null=True,
                upload_to="project_chat/%Y/%m/%d/",
                verbose_name="Файл",
            ),
        ),
        migrations.AlterField(
            model_name="projectchatmessage",
            name="body",
            field=models.TextField(blank=True, verbose_name="Текст сообщения"),
        ),
    ]
