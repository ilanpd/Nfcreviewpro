-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "billingPastDueEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "reengagementD30EmailSentAt" TIMESTAMP(3),
ADD COLUMN     "reengagementD7EmailSentAt" TIMESTAMP(3),
ADD COLUMN     "returnActivatedEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionCanceledEmailSentAt" TIMESTAMP(3),
ADD COLUMN     "subscriptionWelcomeEmailSentAt" TIMESTAMP(3);
