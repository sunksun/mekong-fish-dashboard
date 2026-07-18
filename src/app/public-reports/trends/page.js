'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import TrendsReportContent from '@/components/reports/TrendsReportContent';

export default function PublicTrendsReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <TrendsReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
