import { useEffect, useState } from "react";
import { Wifi, WifiOff, Settings, ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { usePontoOrisTerminalStore, type PunchType } from "@/store/ponto-oris-terminal-store";
import { NumericKeypad } from "@/components/ponto-oris/NumericKeypad";
import { PunchCamera } from "@/components/ponto-oris/PunchCamera";

const PUNCH_LABELS: Record<PunchType, string> = {
  ENTRADA: "Entrada",
  INTERVALO: "Intervalo",
  RETORNO: "Retorno",
  SAIDA: "Saída",
};

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);
  return isOnline;
}

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function TopBar({ companyLabel }: { companyLabel: string }) {
  const isOnline = useOnlineStatus();
  const { forgetDevice } = usePontoOrisTerminalStore();

  return (
    <header className="flex h-16 items-center justify-between bg-[#315F93] px-6 text-white">
      <div className="flex flex-col leading-tight">
        <span className="text-lg font-bold tracking-tight">{companyLabel}</span>
        <span className="text-xs text-white/70">Ponto Óris · Controle de Ponto</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-sm">
          {isOnline ? <Wifi size={18} /> : <WifiOff size={18} className="text-[#D84B4B]" />}
          <span>{isOnline ? "Online" : "Offline"}</span>
        </div>
        <button
          type="button"
          onClick={forgetDevice}
          aria-label="Configurar dispositivo"
          className="text-white/70 hover:text-white"
        >
          <Settings size={18} />
        </button>
      </div>
    </header>
  );
}

function ErrorModal({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-6 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-6 text-center">
        <p className="text-base font-medium text-[#D84B4B]">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="w-full rounded-xl bg-[#315F93] py-3 font-medium text-white active:scale-95"
        >
          Tentar novamente
        </button>
      </div>
    </div>
  );
}

function ProcessingModal() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-6 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center">
        <Loader2 className="animate-spin text-[#315F93]" size={40} />
        <p className="text-base font-medium text-[#26313D]">Confirmando com o servidor...</p>
      </div>
    </div>
  );
}

function SuccessModal({ type }: { type: PunchType | null }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-6 flex w-full max-w-sm flex-col items-center gap-4 rounded-2xl bg-white p-8 text-center">
        <CheckCircle2 className="text-[#31A36D]" size={48} />
        <p className="text-lg font-semibold text-[#26313D]">
          {type ? PUNCH_LABELS[type] : "Marcação"} registrada
        </p>
      </div>
    </div>
  );
}

function DeviceSetupScreen() {
  const { saveDevice } = usePontoOrisTerminalStore();
  const [companyLabel, setCompanyLabel] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [deviceCredential, setDeviceCredential] = useState("");

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-[#F4F6F8] px-6">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!companyLabel || !deviceId || !deviceCredential) return;
          saveDevice({ companyLabel, deviceId, deviceCredential });
        }}
        className="flex w-full max-w-md flex-col gap-4 rounded-2xl bg-white p-8 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-[#26313D]">Configuração do dispositivo</h1>
        <p className="text-sm text-[#26313D]/60">
          Dados fornecidos pelo administrador ao cadastrar este tablet no Ponto Óris.
        </p>
        <label className="flex flex-col gap-1 text-sm text-[#26313D]">
          Nome da empresa
          <input
            value={companyLabel}
            onChange={(e) => setCompanyLabel(e.target.value)}
            className="rounded-lg border border-[#26313D]/15 px-3 py-2.5"
            placeholder="Ex.: Crescer no Campo"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#26313D]">
          ID do dispositivo
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="rounded-lg border border-[#26313D]/15 px-3 py-2.5 font-mono text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-[#26313D]">
          Credencial do dispositivo
          <input
            value={deviceCredential}
            onChange={(e) => setDeviceCredential(e.target.value)}
            type="password"
            className="rounded-lg border border-[#26313D]/15 px-3 py-2.5 font-mono text-sm"
          />
        </label>
        <button
          type="submit"
          className="mt-2 rounded-xl bg-[#315F93] py-3 font-medium text-white active:scale-95"
        >
          Conectar
        </button>
      </form>
    </div>
  );
}

function MatriculaScreen() {
  const now = useClock();
  const { employeeCode, setEmployeeCode, submitEmployeeCode, isBusy } = usePontoOrisTerminalStore();

  const date = now.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const time = now.toLocaleTimeString("pt-BR");

  return (
    <div className="flex flex-1 items-center justify-center gap-16 px-12">
      <div className="flex w-[58%] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm capitalize text-[#26313D]/60">{date}</p>
        <p className="font-mono text-7xl font-semibold tabular-nums text-[#26313D]">{time}</p>
      </div>
      <div className="flex w-[42%] flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium text-[#26313D]">Matrícula</p>
          <div className="flex h-16 items-center rounded-2xl bg-white px-5 text-2xl font-semibold tracking-widest text-[#26313D] shadow-sm">
            {employeeCode || <span className="text-[#26313D]/30">— — — —</span>}
          </div>
        </div>
        <NumericKeypad
          disabled={isBusy}
          onDigit={(d) => setEmployeeCode(employeeCode.length < 8 ? employeeCode + d : employeeCode)}
          onBackspace={() => setEmployeeCode(employeeCode.slice(0, -1))}
        />
        <button
          type="button"
          disabled={!employeeCode || isBusy}
          onClick={submitEmployeeCode}
          className="h-14 rounded-2xl bg-[#315F93] font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          Entrar
        </button>
      </div>
    </div>
  );
}

function PinScreen() {
  const { employeeFirstName, pin, setPin, submitPin } = usePontoOrisTerminalStore();

  return (
    <div className="flex flex-1 items-center justify-center gap-16 px-12">
      <div className="flex w-[58%] flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm text-[#26313D]/60">Olá,</p>
        <p className="text-4xl font-semibold text-[#26313D]">{employeeFirstName}</p>
      </div>
      <div className="flex w-[42%] flex-col gap-6">
        <div>
          <p className="mb-2 text-sm font-medium text-[#26313D]">PIN</p>
          <div className="flex h-16 items-center justify-center gap-3 rounded-2xl bg-white shadow-sm">
            {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
              <span
                key={i}
                className={`h-3 w-3 rounded-full ${i < pin.length ? "bg-[#26313D]" : "bg-[#26313D]/15"}`}
              />
            ))}
          </div>
        </div>
        <NumericKeypad
          onDigit={(d) => setPin(pin.length < 6 ? pin + d : pin)}
          onBackspace={() => setPin(pin.slice(0, -1))}
        />
        <button
          type="button"
          disabled={pin.length < 4}
          onClick={submitPin}
          className="h-14 rounded-2xl bg-[#315F93] font-semibold text-white transition active:scale-95 disabled:opacity-40"
        >
          Confirmar
        </button>
      </div>
    </div>
  );
}

function TipoScreen() {
  const { selectPunchType } = usePontoOrisTerminalStore();
  const types: PunchType[] = ["ENTRADA", "INTERVALO", "RETORNO", "SAIDA"];

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-12">
      <p className="text-xl font-medium text-[#26313D]">Selecione a marcação</p>
      <div className="grid w-full max-w-2xl grid-cols-2 gap-5">
        {types.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => selectPunchType(type)}
            className="flex h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-white text-xl font-semibold text-[#26313D] shadow-sm transition active:scale-95"
          >
            {PUNCH_LABELS[type]}
          </button>
        ))}
      </div>
    </div>
  );
}

function FotoScreen() {
  const { photoBase64, setPhoto, retakePhoto, confirmPunch, punchType } = usePontoOrisTerminalStore();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-12">
      <p className="text-xl font-medium text-[#26313D]">
        Foto da marcação · {punchType ? PUNCH_LABELS[punchType] : ""}
      </p>
      <PunchCamera photoBase64={photoBase64} onCapture={setPhoto} onRetake={retakePhoto} />
      <button
        type="button"
        disabled={!photoBase64}
        onClick={confirmPunch}
        className="h-14 w-full max-w-xs rounded-2xl bg-[#315F93] font-semibold text-white transition active:scale-95 disabled:opacity-40"
      >
        OK
      </button>
    </div>
  );
}

export function PontoOrisTerminalPage() {
  const { step, device, loadDevice, errorMessage, dismissError, lastConfirmedType, reset } =
    usePontoOrisTerminalStore();

  useEffect(() => {
    loadDevice();
  }, [loadDevice]);

  useEffect(() => {
    if (step !== "sucesso") return;
    const id = setTimeout(reset, 2500);
    return () => clearTimeout(id);
  }, [step, reset]);

  if (step === "device-setup" || !device) return <DeviceSetupScreen />;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F4F6F8]">
      <TopBar companyLabel={device.companyLabel} />

      {step === "matricula" && <MatriculaScreen />}
      {step === "pin" && (
        <div className="relative flex flex-1 flex-col">
          <button
            type="button"
            onClick={reset}
            aria-label="Voltar"
            className="absolute left-6 top-6 text-[#26313D]/50"
          >
            <ArrowLeft size={20} />
          </button>
          <PinScreen />
        </div>
      )}
      {step === "tipo" && <TipoScreen />}
      {(step === "foto" || step === "enviando") && <FotoScreen />}
      {step === "sucesso" && <FotoScreen />}

      {step === "enviando" && <ProcessingModal />}
      {step === "sucesso" && <SuccessModal type={lastConfirmedType} />}
      {errorMessage && <ErrorModal message={errorMessage} onDismiss={dismissError} />}
    </div>
  );
}
