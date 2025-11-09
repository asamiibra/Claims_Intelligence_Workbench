// src/types/assessment.ts

export type DamagedPart = {
    part_label: string;
    severity: string;
    confidence: number;
    estimated_cost_min: number;
    estimated_cost_max: number;
  };
  
  export type CostBreakdownEntry = {
    label: string;
    details?: string[];
  };
  
  export type Assessment = {
    damaged_parts: DamagedPart[];
    total_min: number;
    total_max: number;
    overall_confidence: number;
    recommendation: {
      code: string;
      text: string;
    };
    flags: string[];
    image_quality?: string[];
    cost_breakdown?: CostBreakdownEntry[];
    _meta?: {
      model_version: string;
      processing_time_ms: number;
      timestamp: string;
    };
  };
  