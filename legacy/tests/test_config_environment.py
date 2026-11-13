import unittest
from unittest.mock import patch

from config import Config, _normalize_environment


class EnvironmentNameTests(unittest.TestCase):
    def test_normalizes_canonical_and_legacy_names(self):
        for value, expected in (
            ("dev", "dev"),
            ("stg", "stg"),
            ("prod", "prod"),
            ("development", "dev"),
            ("stage", "stg"),
            ("staging", "stg"),
            ("production", "prod"),
            ("  PROD  ", "prod"),
        ):
            with self.subTest(value=value):
                self.assertEqual(_normalize_environment(value), expected)

    def test_only_prod_is_reported_as_production(self):
        for value, expected in (("dev", False), ("stg", False), ("prod", True)):
            with self.subTest(value=value), patch.object(Config, "ENVIRONMENT", value):
                self.assertEqual(Config.is_production(), expected)


if __name__ == "__main__":
    unittest.main()
