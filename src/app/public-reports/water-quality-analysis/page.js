'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import WaterQualityAnalysisReportContent from '@/components/reports/WaterQualityAnalysisReportContent';

export default function PublicWaterQualityAnalysisReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <WaterQualityAnalysisReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
