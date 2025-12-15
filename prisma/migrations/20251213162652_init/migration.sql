-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "AlphaTesterStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BonusBehavior" AS ENUM ('SPEND_AND_EARN', 'SPEND_ONLY', 'EARN_ONLY');

-- CreateEnum
CREATE TYPE "BonusType" AS ENUM ('PURCHASE', 'REFERRAL', 'WELCOME', 'MANUAL', 'PROMO');

-- CreateEnum
CREATE TYPE "BotStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ERROR');

-- CreateEnum
CREATE TYPE "ChatChannelType" AS ENUM ('TELEGRAM', 'WHATSAPP', 'VIBER');

-- CreateEnum
CREATE TYPE "ChatStatus" AS ENUM ('OPEN', 'CLOSED', 'PENDING');

-- CreateEnum
CREATE TYPE "MailingEventType" AS ENUM ('SENT', 'DELIVERED', 'OPENED', 'CLICKED', 'BOUNCED', 'COMPLAINED');

-- CreateEnum
CREATE TYPE "MailingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MailingType" AS ENUM ('BROADCAST', 'TRIGGERED', 'AUTOMATED');

-- CreateEnum
CREATE TYPE "OperationMode" AS ENUM ('LIVE', 'TEST');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "SegmentType" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('EARNED', 'SPENT', 'EXPIRED', 'REFUNDED');

-- This is an empty migration.