"use client";

import { useState } from "react";

import ClaimForm from "../components/ClaimForm";
import ImageUploader from "../components/ImageUploader";
import AssessmentPanel, {
  type OverrideMetadata,
} from "../components/AssessmentPanel";
import DamagedPartsTable from "../components/DamagedPartsTable";
import DecisionBar from "../components/DecisionBar";
import PhotoQuality from "../components/PhotoQuality";
import ActionLog from "../components/ActionLog";
import { ConfidenceMeter, ConfidenceBadge } from "../components/ConfidenceMeter";
import { ConfirmModal, AlertModal } from "../components/Modal";
import { ErrorBoundary } from "../components/ErrorBoundary";

import type { Assessment, DamagedPart, PhotoMeta } from "@/types/assessment";
import {
  PartSeverity,
  VehiclePart,
  RecommendationCode,
} from "@/types/assessment";

/* ---------- Types ---------- */

type Claim = {
  id: string;
  policyNumber: string;
  name: string;
  description: string;
};

type Step = 1 | 2 | 3 | 4;

type Snapshot = {
  claim: Claim | null;
  photos: PhotoMeta[];
  assessment: Assessment | null;
  actions: string[];
  step: Step;
};

/* ---------- Helpers ---------- */

const ts = () => new Date().toISOString().replace("T", " ").slice(0, 19);

// Convert File to PhotoMeta
function fileToPhotoMeta(file: File): PhotoMeta {
  return {
    id: Math.random().toString(36).slice(2),
    url: URL.createObjectURL(file),
    filename: file.name,
    uploadedAt: new Date().toISOString(),
    source: "user",
    meta: {
      mime_type: file.type,
      size_bytes: file.size,
    },
  };
}

/* ==================================================================== */

function HomeContent() {
  /* Core state */
  const [claim, setClaim] = useState<Claim | null>(null);
  const [photos, setPhotos] = useState<PhotoMeta[]>([]);
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [actions, setActions] = useState<string[]>([]);

  /* UX state */
  const [step, setStep] = useState<Step>(1);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [uploadHint, setUploadHint] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [allowNewClaim, setAllowNewClaim] = useState(false);

  /* Modal state - FOR CONFIRMATION DIALOGS */
  const [showEscalateConfirm, setShowEscalateConfirm] = useState(false);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showNewClaimConfirm, setShowNewClaimConfirm] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  /* Edit state - FOR OVERRIDE MODAL CONNECTION */
  const [editingPartIndex, setEditingPartIndex] = useState<number | null>(null);

  /* Undo history */
  const [history, setHistory] = useState<Snapshot[]>([]);

  const snapshot = () => {
    setHistory((prev) => [
      ...prev,
      { claim, photos, assessment, actions, step },
    ]);
  };

  const log = (message: string) => {
    setActions((prev) => [...prev, `${ts()} - ${message}`]);
  };

  const handleUndo = () => {
    setHistory((prev) => {
      if (prev.length === 0) return prev;
      const copy = [...prev];
      const last = copy.pop()!;
      setClaim(last.claim);
      setPhotos(last.photos);
      setAssessment(last.assessment);
      setActions(last.actions);
      setStep(last.step);
      setStatus("Last change undone.");
      setAllowNewClaim(false);
      setUploadHint(null);
      setPolicyError(null);
      return copy;
    });
  };

  /* ---------- Step 1: Claim context ---------- */

  const handleClaimSubmit = (partial: Omit<Claim, "id">) => {
    const normalized = partial.policyNumber.trim().toUpperCase();

    if (!normalized.startsWith("POL-")) {
      setPolicyError('Policy # must start with "POL-".');
      log(`[SYSTEM] Invalid policy number "${partial.policyNumber}" rejected.`);
      return;
    }

    snapshot();

    const newClaim: Claim = {
      id: Math.random().toString(36).slice(2),
      ...partial,
      policyNumber: normalized,
    };

    setClaim(newClaim);
    setPolicyError(null);
    setStep(2);
    setUploadHint("Please upload damage photos to proceed.");
    setAllowNewClaim(false);
    setAssessment(null);
    setStatus("Claim context set.");
    log(`Claim context set for ${newClaim.policyNumber}`);
  };

  /* ---------- Step 2: Photos ---------- */

  const handlePhotosChange = (newFiles: File[]) => {
    if (!claim) return;

    snapshot();
    setRawFiles(newFiles);
    
    const photoMetas = newFiles.map(fileToPhotoMeta);
    setPhotos(photoMetas);
    setUploadHint(null);

    if (newFiles.length >= 2) {
      setStep(3);
      log(`Uploaded ${newFiles.length} photos`);
    } else {
      setStep(2);
    }
  };

  /* ---------- Step 3: Assessment (mock) ---------- */

  const handleRunAssessment = () => {
    if (!claim || photos.length < 2) return;

    snapshot();
    setIsRunning(true);
    setStatus("Running AI assessment...");
    log("AI assessment started");

    setTimeout(() => {
      const mockAssessment: Assessment = {
        damaged_parts: [
          {
            part_id: VehiclePart.REAR_BUMPER,
            part_label: "Rear Bumper",
            severity: PartSeverity.MODERATE,
            confidence: 0.85,
            estimated_cost_min: 50000,
            estimated_cost_max: 80000,
            repair_action: "replace",
          },
        ],
        total_min: 50000,
        total_max: 80000,
        overall_confidence: 0.85,
        recommendation: {
          code: RecommendationCode.FAST_TRACK_REVIEW,
          text: "Approve - high confidence, low exposure",
        },
        flags: [],
        image_quality: ["Good lighting", "Multiple angles provided"],
        cost_breakdown: [
          {
            label: "Rear Bumper",
            details: [
              "Severity: moderate",
              "Range: $500 - $800",
              "Action: replace",
            ],
          },
        ],
        fraud_risk_score: 0.15,
        _meta: {
          model_version: "mock-v1",
          processing_time_ms: 1500,
          timestamp: new Date().toISOString(),
        },
      };

      setAssessment(mockAssessment);
      setIsRunning(false);
      setStep(4);
      setStatus("Assessment complete.");
      log("AI assessment completed");
    }, 2000);
  };

  /* ---------- Step 4: Actions WITH CONFIRMATIONS ---------- */

  const onApprove = () => {
    if (!assessment) return;
    
    // Show confirmation for high-value claims (over $1000)
    if (assessment.total_max > 100000) {
      setShowApproveConfirm(true);
      return;
    }
    
    // Otherwise approve directly
    confirmApprove();
  };

  const confirmApprove = () => {
    snapshot();
    log("Claim approved");
    setAllowNewClaim(true);
    setSuccessMessage("Claim approved successfully! Ready to process next claim.");
    setShowSuccessAlert(true);
    setStatus("Claim approved successfully.");
  };

  const onRequestPhotos = () => {
    snapshot();
    log("Additional photos requested");
    setStep(2);
    setAllowNewClaim(false);
    setUploadHint("Please upload additional photos for better assessment.");
    setStatus("Awaiting additional photos.");
  };

  const onEscalate = () => {
    if (!assessment) return;
    // ALWAYS show confirmation for escalation
    setShowEscalateConfirm(true);
  };

  const confirmEscalate = () => {
    snapshot();
    log("Claim escalated for manual review");
    setAllowNewClaim(true);
    setSuccessMessage("Claim escalated to senior adjuster for manual review.");
    setShowSuccessAlert(true);
    setStatus("Claim escalated for manual review.");
  };

  const onOverride = (
    index: number,
    updated: DamagedPart,
    metadata: OverrideMetadata
  ) => {
    if (!assessment) return;

    snapshot();

    const newParts = [...assessment.damaged_parts];
    newParts[index] = updated;

    const newAssessment: Assessment = {
      ...assessment,
      damaged_parts: newParts,
      total_min: newParts.reduce((sum, p) => sum + p.estimated_cost_min, 0),
      total_max: newParts.reduce((sum, p) => sum + p.estimated_cost_max, 0),
    };

    setAssessment(newAssessment);

    const delta = metadata?.delta ?? 0;
    const deltaPct = metadata?.delta_percent ?? 0;
    const hv = metadata?.high_value_training_data ? ", high-value case" : "";

    log(
      `Override applied to part ${index + 1} (Δ ${delta.toFixed(
        2
      )}, ${(deltaPct * 100).toFixed(1)}%${hv})`
    );
  };

  const onAddPart = (part: DamagedPart) => {
    if (!assessment) return;

    snapshot();

    const damaged_parts = [...assessment.damaged_parts, part];

    const newAssessment: Assessment = {
      ...assessment,
      damaged_parts,
      total_min: damaged_parts.reduce(
        (sum, p) => sum + p.estimated_cost_min,
        0
      ),
      total_max: damaged_parts.reduce(
        (sum, p) => sum + p.estimated_cost_max,
        0
      ),
    };

    setAssessment(newAssessment);
    log("New part added to assessment");
  };

  const onRemovePart = (index: number) => {
    if (!assessment) return;

    snapshot();

    const damaged_parts = assessment.damaged_parts.filter(
      (_, i) => i !== index
    );

    const newAssessment: Assessment = {
      ...assessment,
      damaged_parts,
      total_min: damaged_parts.reduce(
        (sum, p) => sum + p.estimated_cost_min,
        0
      ),
      total_max: damaged_parts.reduce(
        (sum, p) => sum + p.estimated_cost_max,
        0
      ),
    };

    setAssessment(newAssessment);
    log(`Part ${index + 1} removed from assessment`);
  };

  const handleDecisionAction = (
    label: "Approve" | "Request Photos" | "Escalate",
    meta?: { complete?: boolean }
  ) => {
    switch (label) {
      case "Approve":
        onApprove();
        break;
      case "Request Photos":
        onRequestPhotos();
        break;
      case "Escalate":
        onEscalate();
        break;
    }
  };

  /* ---------- New claim reset WITH CONFIRMATION ---------- */

  const handleStartNewClaim = () => {
    // Check if there's unsaved work
    if (assessment && !allowNewClaim) {
      setShowNewClaimConfirm(true);
      return;
    }
    
    confirmNewClaim();
  };

  const confirmNewClaim = () => {
    // Clean up object URLs
    photos.forEach((photo) => {
      if (photo.url) URL.revokeObjectURL(photo.url);
    });

    setClaim(null);
    setPhotos([]);
    setRawFiles([]);
    setAssessment(null);
    setActions([]);
    setStep(1);
    setPolicyError(null);
    setUploadHint(null);
    setStatus(null);
    setAllowNewClaim(false);
    setHistory([]);
    setEditingPartIndex(null);
    log("New claim started");
  };

  /* ==================================================================== */

  return (
    <main className="min-h-screen bg-slate-950 text-slate-50 p-4 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">
              Claims Workbench
            </h1>
            {status && (
              <p className="text-xs text-emerald-400 mt-1">{status}</p>
            )}
          </div>
          <div className="flex gap-2">
            {history.length > 0 && (
              <button
                onClick={handleUndo}
                className="px-3 py-1.5 text-[10px] rounded-md border border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                ↺ Undo last change
              </button>
            )}
            {(allowNewClaim || assessment) && (
              <button
                onClick={handleStartNewClaim}
                className="px-3 py-1.5 text-[10px] rounded-md bg-slate-800 text-slate-100 hover:bg-slate-700"
              >
                Start new claim
              </button>
            )}
          </div>
        </header>

        {/* Claim context */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <ClaimForm onSubmit={handleClaimSubmit} policyError={policyError} />
        </section>

        {/* Main layout */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {/* Left Column: Damage Photos */}
          <div className="space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h2 className="text-sm font-semibold mb-2 text-slate-100">
                Damage Photos
              </h2>
              <p className="text-[11px] text-slate-400 mb-3">
                Upload 2–4 photos (rear, side, close-ups) to run assessment.
              </p>
              <ImageUploader
                photos={rawFiles}
                onChange={handlePhotosChange}
                disabled={!claim}
                hint={
                  uploadHint ||
                  (claim && !photos.length
                    ? "Next: add photos to unlock AI assessment."
                    : undefined)
                }
              />
              <div className="mt-2 flex items-start gap-1 text-[10px] text-amber-300">
                <span className="mt-[1px]">💡</span>
                <span>
                  Clear, well-lit photos from multiple angles help the AI produce
                  a more confident and accurate assessment.
                </span>
              </div>
            </div>

            {/* Photo Quality Component */}
            {photos.length > 0 && (
              <PhotoQuality photos={photos} />
            )}
          </div>

          {/* Right Column: Assessment */}
          <div className="space-y-4">
            {/* Overall Confidence Badge (if assessment exists) */}
            {assessment && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-slate-100">
                    Overall Confidence
                  </h3>
                  <ConfidenceBadge value={assessment.overall_confidence} />
                </div>
                <ConfidenceMeter
                  value={assessment.overall_confidence}
                  showLabel
                  showIcon
                  variant="detailed"
                  size="lg"
                />
                
                {/* Fraud Risk Score (if present and elevated) */}
                {assessment.fraud_risk_score !== undefined && assessment.fraud_risk_score > 0.3 && (
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-xs font-medium text-amber-300">Fraud Risk Detected</p>
                        <p className="text-xs text-amber-400">
                          Risk Score: {(assessment.fraud_risk_score * 100).toFixed(0)}%
                          {assessment.fraud_risk_score > 0.6 && " - Review recommended"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Assessment Panel WITH EDIT CONNECTION */}
            <AssessmentPanel
              claim={claim}
              photos={rawFiles}
              assessment={assessment}
              isRunning={isRunning}
              onRunAssessment={handleRunAssessment}
              onApprove={onApprove}
              onRequestPhotos={onRequestPhotos}
              onEscalate={onEscalate}
              onOverride={onOverride}
              onAddPart={onAddPart}
              onRemovePart={onRemovePart}
              editingIndex={editingPartIndex}
              onEditingIndexChange={setEditingPartIndex}
            />

            {/* Damaged Parts Table */}
            {assessment && assessment.damaged_parts.length > 0 && (
              <DamagedPartsTable
                parts={assessment.damaged_parts}
                onEdit={(index) => {
                  setEditingPartIndex(index);
                  log(`Opening override modal for part ${index + 1}`);
                }}
              />
            )}

            {/* Decision Bar */}
            {assessment && (
              <DecisionBar
                assessment={assessment}
                onAction={handleDecisionAction}
                disabled={isRunning}
              />
            )}
          </div>
        </section>

        {/* Audit trail */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2 text-slate-100">
            Audit Trail
          </h2>
          <ActionLog actions={actions} />
        </section>
      </div>

      {/* =============================================== */}
      {/* ALL CONFIRMATION MODALS */}
      {/* =============================================== */}

      {/* Approve Confirmation (for high-value claims) */}
      <ConfirmModal
        open={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={() => {
          confirmApprove();
          setShowApproveConfirm(false);
        }}
        title="Confirm Approval"
        message={`This claim has a total estimated cost of $${((assessment?.total_max ?? 0) / 100).toFixed(0)}. Are you sure you want to approve it for fast-track processing?`}
        variant="success"
        confirmLabel="Yes, Approve"
        cancelLabel="Cancel"
      />

      {/* Escalate Confirmation */}
      <ConfirmModal
        open={showEscalateConfirm}
        onClose={() => setShowEscalateConfirm(false)}
        onConfirm={() => {
          confirmEscalate();
          setShowEscalateConfirm(false);
        }}
        title="Escalate Claim"
        message="Are you sure you want to escalate this claim for manual review? This action will be logged and the claim will be assigned to a senior adjuster."
        variant="warning"
        confirmLabel="Yes, Escalate"
        cancelLabel="Cancel"
      />

      {/* New Claim Confirmation (when unsaved work exists) */}
      <ConfirmModal
        open={showNewClaimConfirm}
        onClose={() => setShowNewClaimConfirm(false)}
        onConfirm={() => {
          confirmNewClaim();
          setShowNewClaimConfirm(false);
        }}
        title="Start New Claim"
        message="You have an assessment in progress. Starting a new claim will discard all current data. Are you sure you want to continue?"
        variant="danger"
        confirmLabel="Yes, Discard & Start New"
        cancelLabel="Cancel"
      />

      {/* Success Alert (after approve/escalate) */}
      <AlertModal
        open={showSuccessAlert}
        onClose={() => setShowSuccessAlert(false)}
        title="Success"
        message={successMessage}
        variant="success"
      />
    </main>
  );
}

/* Wrap with ErrorBoundary */
export default function Home() {
  return (
    <ErrorBoundary>
      <HomeContent />
    </ErrorBoundary>
  );
}