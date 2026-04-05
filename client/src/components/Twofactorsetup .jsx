// client/src/components/TwoFactorSetup.jsx — Sprint 1: 2FA Setup & Management
import React, { useState } from "react";
import styled, { keyframes } from "styled-components";
import axios from "axios";
import { toast } from "react-toastify";
import { FaShieldAlt, FaTimes, FaCheck, FaCopy, FaQrcode } from "react-icons/fa";
import { setup2FARoute, verify2FARoute, disable2FARoute } from "../utils/APIRoutes";
import useChatStore from "../store/chatStore";

export default function TwoFactorSetup({ onClose }) {
  const { currentUser } = useChatStore();
  const [step, setStep] = useState("start"); // start | qr | backup | done
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);

  const token = currentUser?.token || sessionStorage.getItem("chat-app-token");
  const headers = { Authorization: `Bearer ${token}` };

  const is2FAEnabled = currentUser?.twoFactor?.enabled;

  const handleSetup = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(setup2FARoute, {}, { headers });
      if (data.status) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setStep("qr");
      }
    } catch {
      toast.error("Failed to initialize 2FA setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (totpCode.length !== 6) { toast.warning("Enter the 6-digit code from your app."); return; }
    setLoading(true);
    try {
      const { data } = await axios.post(verify2FARoute, { token: totpCode }, { headers });
      if (data.status) {
        setBackupCodes(data.backupCodes);
        setStep("backup");
        toast.success("2FA activated successfully!");
      } else {
        toast.error(data.msg || "Invalid code. Try again.");
      }
    } catch {
      toast.error("Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!window.confirm("Are you sure you want to disable 2FA? This will make your account less secure.")) return;
    setLoading(true);
    try {
      const { data } = await axios.post(disable2FARoute, {}, { headers });
      if (data.status) {
        toast.success("2FA has been disabled.");
        onClose();
      }
    } catch {
      toast.error("Failed to disable 2FA.");
    } finally {
      setLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("Backup codes copied!");
  };

  return (
    <Overlay onClick={onClose}>
      <Modal onClick={e => e.stopPropagation()}>
        <Header>
          <FaShieldAlt className="icon" />
          <span>Two-Factor Authentication</span>
          <FaTimes className="close" onClick={onClose} />
        </Header>

        {/* Already enabled */}
        {is2FAEnabled && step === "start" && (
          <Body>
            <StatusBadge $active>2FA is active on your account</StatusBadge>
            <p className="desc">Your account is protected with an authenticator app. To disable 2FA, click the button below.</p>
            <Button $danger onClick={handleDisable} disabled={loading}>
              {loading ? "Disabling..." : "Disable 2FA"}
            </Button>
          </Body>
        )}

        {/* Not yet enabled — start */}
        {!is2FAEnabled && step === "start" && (
          <Body>
            <StatusBadge>2FA is not enabled</StatusBadge>
            <p className="desc">
              Add an extra layer of security. Each login will require a 6-digit code from your authenticator app (Google Authenticator, Authy, etc.).
            </p>
            <Button onClick={handleSetup} disabled={loading}>
              {loading ? "Setting up..." : "Enable 2FA →"}
            </Button>
          </Body>
        )}

        {/* Step 2: Scan QR */}
        {step === "qr" && (
          <Body>
            <StepLabel>Step 1 — Scan this QR code</StepLabel>
            <p className="desc">Open your authenticator app and scan the code below.</p>
            {qrCode && <QRImg src={qrCode} alt="2FA QR Code" />}
            <SecretRow>
              <span className="label">Manual entry:</span>
              <code>{secret}</code>
              <FaCopy className="copy-icon" onClick={() => { navigator.clipboard.writeText(secret); toast.success("Secret copied!"); }} />
            </SecretRow>
            <StepLabel style={{ marginTop: "1.25rem" }}>Step 2 — Enter the 6-digit code</StepLabel>
            <CodeInput
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={e => setTotpCode(e.target.value.replace(/\D/g, ""))}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              autoFocus
            />
            <Button onClick={handleVerify} disabled={loading || totpCode.length !== 6}>
              {loading ? "Verifying..." : <><FaCheck /> Verify & Activate</>}
            </Button>
          </Body>
        )}

        {/* Step 3: Save backup codes */}
        {step === "backup" && (
          <Body>
            <StepLabel>Save your backup codes</StepLabel>
            <p className="desc">
              Store these codes somewhere safe. Each code can be used once if you lose access to your authenticator app.
            </p>
            <BackupGrid>
              {backupCodes.map((c, i) => <code key={i}>{c}</code>)}
            </BackupGrid>
            <Button $secondary onClick={copyBackupCodes}>
              <FaCopy /> Copy all codes
            </Button>
            <Button onClick={() => { setStep("done"); onClose(); }} style={{ marginTop: "8px" }}>
              Done — I've saved my codes
            </Button>
          </Body>
        )}
      </Modal>
    </Overlay>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const fadeIn = keyframes`from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); }`;

const Overlay = styled.div`
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
`;

const Modal = styled.div`
  background: var(--bg-panel); border: 1px solid var(--glass-border);
  border-radius: var(--radius-xl); width: min(440px, 95vw);
  box-shadow: 0 24px 64px rgba(0,0,0,0.4);
  animation: ${fadeIn} 0.25s var(--ease-spring);
  color: var(--text-primary); overflow: hidden;
`;

const Header = styled.div`
  display: flex; align-items: center; gap: 10px;
  padding: 1.1rem 1.5rem; border-bottom: 1px solid var(--border-subtle);
  font-weight: 700; font-size: var(--text-base);
  .icon { color: var(--msg-sent); font-size: 1.1rem; }
  .close { margin-left: auto; cursor: pointer; color: var(--text-secondary); font-size: 1.1rem;
    transition: color var(--duration-fast); &:hover { color: var(--color-danger); } }
`;

const Body = styled.div`
  padding: 1.5rem;
  display: flex; flex-direction: column; gap: 12px;
  .desc { font-size: var(--text-sm); color: var(--text-secondary); line-height: 1.6; }
`;

const StatusBadge = styled.div`
  display: inline-flex; align-items: center; gap: 6px;
  padding: 6px 14px; border-radius: var(--radius-full);
  font-size: var(--text-xs); font-weight: 700;
  background: ${({ $active }) => $active ? "rgba(34,211,165,0.12)" : "rgba(239,68,68,0.1)"};
  color: ${({ $active }) => $active ? "var(--color-success)" : "var(--color-danger)"};
  border: 1px solid ${({ $active }) => $active ? "rgba(34,211,165,0.25)" : "rgba(239,68,68,0.2)"};
  align-self: flex-start;
  &::before { content: "${({ $active }) => $active ? "✓" : "✗"}"; }
`;

const StepLabel = styled.div`
  font-size: var(--text-xs); font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.5px; color: var(--text-secondary);
`;

const QRImg = styled.img`
  width: 180px; height: 180px; align-self: center;
  border-radius: var(--radius-md); border: 4px solid white;
`;

const SecretRow = styled.div`
  display: flex; align-items: center; gap: 8px;
  background: var(--bg-overlay); border-radius: var(--radius-md);
  padding: 8px 12px; font-size: var(--text-xs); flex-wrap: wrap;
  .label { color: var(--text-secondary); }
  code { font-family: monospace; color: var(--msg-sent); letter-spacing: 1px; flex: 1; }
  .copy-icon { cursor: pointer; color: var(--text-secondary); transition: color var(--duration-fast);
    &:hover { color: var(--msg-sent); } }
`;

const CodeInput = styled.input`
  width: 100%; padding: 14px; text-align: center; font-size: 2rem;
  letter-spacing: 12px; font-family: monospace; font-weight: 700;
  background: var(--input-bg); border: 1.5px solid var(--border-default);
  border-radius: var(--radius-md); color: var(--text-primary); outline: none;
  transition: border-color var(--duration-base);
  &:focus { border-color: var(--msg-sent); box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }
`;

const BackupGrid = styled.div`
  display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
  code {
    background: var(--bg-overlay); border-radius: var(--radius-sm);
    padding: 8px 12px; font-family: monospace; font-size: var(--text-sm);
    text-align: center; letter-spacing: 2px; color: var(--text-primary);
    border: 1px solid var(--border-subtle);
  }
`;

const Button = styled.button`
  display: flex; align-items: center; justify-content: center; gap: 8px;
  width: 100%; padding: 12px; border-radius: var(--radius-md);
  font-size: var(--text-sm); font-weight: 700; cursor: pointer;
  border: none; transition: all var(--duration-base); font-family: 'Plus Jakarta Sans', sans-serif;
  background: ${({ $danger, $secondary }) =>
    $danger ? "rgba(239,68,68,0.12)" :
    $secondary ? "var(--bg-overlay)" :
    "var(--aurora-gradient)"};
  color: ${({ $danger, $secondary }) =>
    $danger ? "var(--color-danger)" :
    $secondary ? "var(--text-primary)" :
    "white"};
  box-shadow: ${({ $danger, $secondary }) =>
    !$danger && !$secondary ? "0 4px 16px rgba(124,58,237,0.3)" : "none"};
  &:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
  &:disabled { opacity: 0.5; cursor: not-allowed; }
`;
