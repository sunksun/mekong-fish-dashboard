'use client';

import PublicReportLayout from '@/components/Layout/PublicReportLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { USER_ROLES } from '@/types';
import WaterLevelAnalysisReportContent from '@/components/reports/WaterLevelAnalysisReportContent';

export default function PublicWaterLevelAnalysisReportPage() {
  return (
    <ProtectedRoute requiredRoles={[USER_ROLES.MEMBER]} fallbackPath="/login">
      <PublicReportLayout>
        <WaterLevelAnalysisReportContent />
      </PublicReportLayout>
    </ProtectedRoute>
  );
}
