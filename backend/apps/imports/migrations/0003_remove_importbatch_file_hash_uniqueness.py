from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("imports", "0002_importbatch_rows_processed_alter_importbatch_status"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="importbatch",
            name="uq_import_type_sha256_completed",
        ),
    ]
