-- CreateTable
CREATE TABLE "widget_settings" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "registration_title" TEXT NOT NULL DEFAULT 'Зарегистрируйся и получи {bonusAmount} бонусов!',
    "registration_description" TEXT NOT NULL DEFAULT 'Зарегистрируйся в нашей бонусной программе',
    "registration_button_text" TEXT NOT NULL DEFAULT 'Для участия в акции перейдите в бота',
    "registration_button_url" TEXT,
    "verification_button_url" TEXT,
    "registration_fallback_text" TEXT NOT NULL DEFAULT 'Свяжитесь с администратором для регистрации',
    "show_icon" BOOLEAN NOT NULL DEFAULT true,
    "show_title" BOOLEAN NOT NULL DEFAULT true,
    "show_description" BOOLEAN NOT NULL DEFAULT true,
    "show_button" BOOLEAN NOT NULL DEFAULT true,
    "show_fallback_text" BOOLEAN NOT NULL DEFAULT true,
    "product_badge_enabled" BOOLEAN NOT NULL DEFAULT true,
    "product_badge_show_on_cards" BOOLEAN NOT NULL DEFAULT true,
    "product_badge_show_on_product_page" BOOLEAN NOT NULL DEFAULT true,
    "product_badge_text" TEXT NOT NULL DEFAULT 'Начислим до {bonusAmount} бонусов',
    "product_badge_link_url" TEXT,
    "product_badge_bonus_percent" DECIMAL(5,2) NOT NULL DEFAULT 10,
    "product_badge_position" TEXT NOT NULL DEFAULT 'after-price',
    "product_badge_custom_selector" TEXT,
    "registration_styles" JSONB DEFAULT '{}',
    "product_badge_styles" JSONB DEFAULT '{}',
    "widget_styles" JSONB DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "widget_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "widget_settings_project_id_key" ON "widget_settings"("project_id");

-- AddForeignKey
ALTER TABLE "widget_settings" ADD CONSTRAINT "widget_settings_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Migrate existing data from bot_settings.functional_settings.widgetSettings
-- This will be done in a separate data migration script
