'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { toast } from '@/hooks/use-toast'
import {
  Usb,
  Wifi,
  Download,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Copy,
  RefreshCw,
  Radio,
  ChevronDown,
  ChevronRight,
  TreePine,
  MapPin,
  BatteryCharging,
  Antenna,
  Zap,
  Smartphone,
  Check,
  ArrowLeft,
  ArrowRight,
  HelpCircle,
  Cable,
} from 'lucide-react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConnectionConfig {
  id: string
  type: string
  serialPort: string
  mqttBroker: string
  mqttTopic: string
  mqttUsername: string
  mqttPassword: string
  isEnabled: boolean
  lastSync: string | null
  status: string
}

interface ConnectionTabProps {
  onSyncComplete?: () => void
}

// ---------------------------------------------------------------------------
// Wizard step progress bar
// ---------------------------------------------------------------------------

const WIZARD_STEPS = [
  { id: 1, title: 'Подготовка', icon: Smartphone },
  { id: 2, title: 'Подключение', icon: Cable },
  { id: 3, title: 'Проверка', icon: CheckCircle2 },
]

function WizardProgressBar({ currentStep, completedSteps }: { currentStep: number; completedSteps: Set<number> }) {
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {WIZARD_STEPS.map((step, idx) => {
        const Icon = step.icon
        const isActive = step.id === currentStep
        const isCompleted = completedSteps.has(step.id)
        const isPast = step.id < currentStep || isCompleted

        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={`rounded-full h-10 w-10 flex items-center justify-center transition-all ${
                  isCompleted
                    ? 'bg-green-500 text-white shadow-md shadow-green-500/25'
                    : isActive
                    ? 'bg-teal-500 text-white shadow-md shadow-teal-500/25'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {isCompleted ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={`text-xs font-medium ${isActive || isCompleted ? 'text-foreground' : 'text-muted-foreground'}`}>
                {step.title}
              </span>
            </div>
            {idx < WIZARD_STEPS.length - 1 && (
              <div className={`w-16 sm:w-24 h-0.5 mx-2 mb-5 transition-all ${
                isPast ? 'bg-green-400' : 'bg-muted'
              }`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Copy button
// ---------------------------------------------------------------------------

function CopyButton({ text, label }: { text: string; label?: string }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    toast({ title: 'Скопировано', description: label || text })
  }
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={handleCopy}>
      <Copy className="h-3.5 w-3.5" />
    </Button>
  )
}

// ---------------------------------------------------------------------------
// Collapsible sub-step
// ---------------------------------------------------------------------------

function SubStep({
  title,
  completed,
  onToggle,
  children,
}: {
  title: string
  completed: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`rounded-full h-6 w-6 flex items-center justify-center shrink-0 transition-colors ${
            completed ? 'bg-green-500 text-white' : 'bg-muted text-muted-foreground'
          }`}>
            {completed ? <Check className="h-3.5 w-3.5" /> : <span className="text-xs font-bold">1</span>}
          </div>
          <span className="font-medium text-sm">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className={`text-xs h-7 ${completed ? 'text-green-600' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggle() }}
          >
            {completed ? 'Готово' : 'Отметить'}
          </Button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </button>
      {completed && children && (
        <div className="px-4 pb-3 pt-0 border-t bg-muted/20">
          {children}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ConnectionTab({ onSyncComplete }: ConnectionTabProps) {
  const [config, setConfig] = useState<ConnectionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [wizardStep, setWizardStep] = useState(1)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showGuide, setShowGuide] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testSuccess, setTestSuccess] = useState(false)

  // Load config from server
  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/meshtastic/sync')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
        // If already connected, skip to step 3
        if (data.status === 'connected' && data.lastSync) {
          setCompletedSteps(new Set([1, 2, 3]))
          setWizardStep(3)
        }
      }
    } catch (err) {
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
    // Restore wizard progress from localStorage
    const saved = localStorage.getItem('connection-wizard-progress')
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as { steps: number[]; currentStep: number }
        if (parsed.steps?.length) {
          setCompletedSteps(new Set(parsed.steps))
        }
        if (parsed.currentStep) {
          setWizardStep(parsed.currentStep)
        }
      } catch { /* ignore */ }
    }
  }, [loadConfig])

  // Save wizard progress to localStorage
  const saveProgress = (steps: Set<number>, step: number) => {
    localStorage.setItem('connection-wizard-progress', JSON.stringify({
      steps: Array.from(steps),
      currentStep: step,
    }))
  }

  const toggleStep = (step: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) {
        next.delete(step)
      } else {
        next.add(step)
      }
      saveProgress(next, wizardStep)
      return next
    })
  }

  const goToStep = (step: number) => {
    setWizardStep(step)
    saveProgress(completedSteps, step)
  }

  const handleSave = async () => {
    if (!config) return
    setSaving(true)
    try {
      const res = await fetch('/api/meshtastic/sync', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      })
      if (res.ok) {
        toast({ title: 'Сохранено', description: 'Настройки подключения обновлены' })
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось сохранить настройки', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadScript = () => {
    window.open('/api/meshtastic/script', '_blank')
    toast({ title: 'Скачивание', description: 'techo-bridge.py загружается...' })
  }

  const handleTestSync = async () => {
    setTesting(true)
    try {
      const res = await fetch('/api/meshtastic/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'test',
          nodes: [{
            nodeId: 9999,
            name: 'Test Node 433',
            shortName: 'TST4',
            hardwareModel: 'T-Echo',
            role: 'TRACKER',
            batteryLevel: 95,
            voltage: 3.85,
            snr: 8.5,
            rssi: -42,
            latitude: 55.7558,
            longitude: 37.6173,
            altitude: 156,
            temperature: 22.5,
            humidity: 55.0,
          }],
        }),
      })
      if (res.ok) {
        setTestSuccess(true)
        toast({ title: 'Тест успешен', description: 'API синхронизации работает корректно' })
        onSyncComplete?.()
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось выполнить тест', variant: 'destructive' })
    } finally {
      setTesting(false)
    }
  }

  const updateConfig = (updates: Partial<ConnectionConfig>) => {
    setConfig(prev => prev ? { ...prev, ...updates } : prev)
  }

  // Generate the ready-to-use run command
  const generateRunCommand = () => {
    if (!config) return ''
    if (config.type === 'mqtt') {
      let cmd = `python techo-bridge.py --mode mqtt --broker ${config.mqttBroker || 'mqtt.meshtastic.org:1883'} --topic ${config.mqttTopic || 'msh/EU_433/#'}`
      if (config.mqttUsername) cmd += ` --mqtt-user ${config.mqttUsername}`
      if (config.mqttPassword) cmd += ` --mqtt-pass ${config.mqttPassword}`
      return cmd
    }
    return `python techo-bridge.py --mode serial --port ${config.serialPort || '/dev/ttyUSB0'} --dashboard http://localhost:3000`
  }

  // Status config for banner
  const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    connected: { label: 'Подключено', color: 'text-green-500', icon: CheckCircle2 },
    disconnected: { label: 'Отключено', color: 'text-muted-foreground', icon: XCircle },
    error: { label: 'Ошибка', color: 'text-red-500', icon: AlertTriangle },
  }

  const currentStatus = statusConfig[config?.status || 'disconnected'] || statusConfig.disconnected

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* ── Connection Status Banner (compact) ── */}
      <Card className={config?.status === 'connected' ? 'border-green-300 dark:border-green-800' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <currentStatus.icon className={`h-5 w-5 ${currentStatus.color}`} />
              <div>
                <p className="font-medium text-sm">{currentStatus.label}</p>
                {config?.lastSync && (
                  <p className="text-xs text-muted-foreground">
                    Последняя синхронизация: {new Date(config.lastSync).toLocaleString('ru')}
                  </p>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={loadConfig} className="gap-1.5">
              <RefreshCw className="h-3.5 w-3.5" />
              Обновить
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ── Wizard ── */}
      <Card>
        <CardContent className="p-6">
          <WizardProgressBar currentStep={wizardStep} completedSteps={completedSteps} />

          {/* ════════════════════════════════════════════════════════ */}
          {/* STEP 1: Подготовка устройства                            */}
          {/* ════════════════════════════════════════════════════════ */}
          {wizardStep === 1 && (
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-1">Подготовка устройства</h3>
                <p className="text-sm text-muted-foreground">
                  Перед первым подключением настройте T-Echo через приложение Meshtastic или USB
                </p>
              </div>

              {/* Sub-step 1: Flash */}
              <SubStep
                title="Прошивка Meshtastic"
                completed={completedSteps.has(11)}
                onToggle={() => toggleStep(11)}
              >
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">Установите приложение Meshtastic на телефон и прошейте T-Echo по Bluetooth, или через USB:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-background px-2 py-1.5 rounded flex-1">
                      pip install meshtastic &amp;&amp; python -m meshtastic --flash
                    </code>
                    <CopyButton text="pip install meshtastic && python -m meshtastic --flash" />
                  </div>
                </div>
              </SubStep>

              {/* Sub-step 2: Region */}
              <SubStep
                title="Установите регион EU_433"
                completed={completedSteps.has(12)}
                onToggle={() => toggleStep(12)}
              >
                <div className="mt-2 space-y-2">
                  <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/20 py-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                    <AlertDescription className="text-xs text-red-800 dark:text-red-200">
                      <strong>Все устройства</strong> должны иметь одинаковый регион! EU_433 для России.
                    </AlertDescription>
                  </Alert>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-background px-2 py-1.5 rounded flex-1">
                      python -m meshtastic --set lora.region EU_433
                    </code>
                    <CopyButton text="python -m meshtastic --set lora.region EU_433" />
                  </div>
                  <p className="text-xs text-muted-foreground">Или в приложении: Device Settings → LoRa → Region → EU_433</p>
                </div>
              </SubStep>

              {/* Sub-step 3: Channel */}
              <SubStep
                title="Создайте приватный канал"
                completed={completedSteps.has(13)}
                onToggle={() => toggleStep(13)}
              >
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    В приложении: Channel Settings → + New channel → Private → Share → QR Code
                  </p>
                  <p className="text-xs text-muted-foreground">
                    На остальных устройствах нажмите <strong>Scan QR</strong> и отсканируйте код.
                  </p>
                  <p className="text-xs text-muted-foreground">Модем: <Badge variant="outline" className="text-[10px]">LongModerate</Badge> — оптимально для леса</p>
                </div>
              </SubStep>

              {/* Sub-step 4: Roles */}
              <SubStep
                title="Настройте роли устройств"
                completed={completedSteps.has(14)}
                onToggle={() => toggleStep(14)}
              >
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">Установите роль на каждом устройстве:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="text-[10px] bg-teal-500">ROUTER</Badge>
                      <span className="text-muted-foreground">Base Station (ПК)</span>
                      <CopyButton text="python -m meshtastic --set device.role ROUTER" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="text-[10px] bg-amber-500">REPEATER</Badge>
                      <span className="text-muted-foreground">Ретранслятор</span>
                      <CopyButton text="python -m meshtastic --set device.role REPEATER" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="text-[10px] bg-green-600">TRACKER</Badge>
                      <span className="text-muted-foreground">Сон 5 мин</span>
                      <CopyButton text="python -m meshtastic --set device.role TRACKER --set power.ls_secs 300" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <Badge className="text-[10px] bg-green-600">TRACKER</Badge>
                      <span className="text-muted-foreground">Сон 45 мин</span>
                      <CopyButton text="python -m meshtastic --set device.role TRACKER --set power.ls_secs 2700" />
                    </div>
                  </div>
                </div>
              </SubStep>

              <div className="flex justify-end pt-2">
                <Button onClick={() => goToStep(2)} className="gap-2">
                  Далее
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* STEP 2: Подключение к дашборду                          */}
          {/* ════════════════════════════════════════════════════════ */}
          {wizardStep === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold mb-1">Подключение к дашборду</h3>
                <p className="text-sm text-muted-foreground">
                  Скачайте скрипт-мост, настройте параметры подключения и запустите
                </p>
              </div>

              {/* Download script card */}
              <div className="flex items-center gap-4 p-4 rounded-lg bg-teal-50 dark:bg-teal-950/20 border border-teal-200 dark:border-teal-800">
                <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/40">
                  <Download className="h-6 w-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">techo-bridge.py</p>
                  <p className="text-xs text-muted-foreground">Python-скрипт для подключения T-Echo к дашборду</p>
                </div>
                <Button onClick={handleDownloadScript} variant="outline" size="sm" className="gap-1.5">
                  <Download className="h-3.5 w-3.5" />
                  Скачать
                </Button>
              </div>

              {/* Connection method selector */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Способ подключения</Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => updateConfig({ type: 'serial' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      config?.type !== 'mqtt'
                        ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <Usb className={`h-5 w-5 mb-2 ${config?.type !== 'mqtt' ? 'text-teal-500' : 'text-muted-foreground'}`} />
                    <p className="font-medium text-sm">USB / Serial</p>
                    <p className="text-xs text-muted-foreground">T-Echo подключён к этому ПК по USB</p>
                  </button>
                  <button
                    onClick={() => updateConfig({ type: 'mqtt' })}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      config?.type === 'mqtt'
                        ? 'border-teal-500 bg-teal-50/50 dark:bg-teal-950/20'
                        : 'border-muted hover:border-muted-foreground/30'
                    }`}
                  >
                    <Wifi className={`h-5 w-5 mb-2 ${config?.type === 'mqtt' ? 'text-teal-500' : 'text-muted-foreground'}`} />
                    <p className="font-medium text-sm">MQTT</p>
                    <p className="text-xs text-muted-foreground">Подключение через MQTT-брокер</p>
                  </button>
                </div>
              </div>

              <Separator />

              {/* Serial settings */}
              {config?.type !== 'mqtt' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Настройки Serial</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Порт устройства</Label>
                      <div className="flex gap-2">
                        <Input
                          value={config?.serialPort || '/dev/ttyUSB0'}
                          onChange={(e) => updateConfig({ serialPort: e.target.value })}
                          className="font-mono text-sm"
                          placeholder="/dev/ttyUSB0"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        Linux: /dev/ttyUSB0 &middot; macOS: /dev/cu.usbmodem* &middot; Windows: COM3
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* MQTT settings */}
              {config?.type === 'mqtt' && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Настройки MQTT</Label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Брокер</Label>
                      <Input
                        value={config?.mqttBroker || 'mqtt.meshtastic.org:1883'}
                        onChange={(e) => updateConfig({ mqttBroker: e.target.value })}
                        className="font-mono text-sm"
                        placeholder="mqtt://..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Топик</Label>
                      <Input
                        value={config?.mqttTopic || 'msh/EU_433/#'}
                        onChange={(e) => updateConfig({ mqttTopic: e.target.value })}
                        className="font-mono text-sm"
                        placeholder="msh/EU_433/#"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Имя пользователя</Label>
                      <Input
                        value={config?.mqttUsername || ''}
                        onChange={(e) => updateConfig({ mqttUsername: e.target.value })}
                        className="text-sm"
                        placeholder="Необязательно"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Пароль</Label>
                      <Input
                        value={config?.mqttPassword || ''}
                        onChange={(e) => updateConfig({ mqttPassword: e.target.value })}
                        className="text-sm"
                        type="password"
                        placeholder="Необязательно"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Install dependencies + Run command */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Запуск</Label>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">1. Установите зависимости (один раз):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-3 py-2 rounded flex-1">
                      pip install meshtastic requests
                    </code>
                    <CopyButton text="pip install meshtastic requests" />
                  </div>
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">2. Запустите скрипт:</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-3 py-2 rounded flex-1 break-all">
                      {generateRunCommand()}
                    </code>
                    <CopyButton text={generateRunCommand()} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button variant="outline" onClick={() => goToStep(1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Назад
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    onClick={handleSave}
                    disabled={saving}
                    className="gap-1.5"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${saving ? 'animate-spin' : ''}`} />
                    Сохранить
                  </Button>
                  <Button onClick={() => goToStep(3)} className="gap-2">
                    Далее
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════ */}
          {/* STEP 3: Проверка                                       */}
          {/* ════════════════════════════════════════════════════════ */}
          {wizardStep === 3 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-semibold mb-1">Проверка подключения</h3>
                <p className="text-sm text-muted-foreground">
                  Проверьте, что API синхронизации работает корректно
                </p>
              </div>

              {!testSuccess ? (
                <div className="flex flex-col items-center py-8 space-y-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Radio className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium">Тест подключения к API</p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      Нажмите кнопку ниже, чтобы проверить, что дашборд корректно принимает данные от устройств
                    </p>
                  </div>
                  <Button
                    onClick={handleTestSync}
                    disabled={testing}
                    size="lg"
                    className="gap-2"
                  >
                    {testing ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <Radio className="h-4 w-4" />
                    )}
                    {testing ? 'Проверка...' : 'Запустить тест'}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8 space-y-4">
                  <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/30">
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="font-medium text-green-600">Подключение работает!</p>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      API синхронизации принимает данные. Убедитесь, что устройства появились на вкладке «Статус».
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setTestSuccess(false); onSyncComplete?.() }}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Обновить данные
                    </Button>
                    <Button
                      onClick={() => { toggleStep(3); }}
                      variant="outline"
                      className="gap-1.5"
                    >
                      <Check className="h-4 w-4" />
                      Всё настроено
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex justify-start pt-2">
                <Button variant="outline" onClick={() => goToStep(2)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Назад
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Collapsible Reference Guide ── */}
      <Card>
        <button
          onClick={() => setShowGuide(!showGuide)}
          className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
        >
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm text-muted-foreground">Справочник: советы для лесного трекинга</span>
          </div>
          {showGuide ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </button>

        {showGuide && (
          <CardContent className="pt-0 pb-4 space-y-4">
            {/* 433 MHz banner */}
            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <Radio className="h-4 w-4 text-green-600" />
              <AlertTitle>433 МГц для леса</AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200 text-sm">
                Частота 433 МГц лучше проникает сквозь деревья. Дальность в лесу на 40-60% больше, чем на 868 МГц.
              </AlertDescription>
            </Alert>

            {/* Quick commands reference */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Быстрая настройка одним блоком
              </h4>
              <div className="flex items-start gap-2">
                <code className="text-[11px] font-mono bg-muted p-3 rounded leading-relaxed flex-1 whitespace-pre-wrap">
{`python -m meshtastic --set lora.region EU_433 \\
  --set device.role TRACKER \\
  --set power.ls_secs 300 \\
  --set power.is_power_saving true \\
  --set gps.enabled true \\
  --set gps.update_interval 30 \\
  --set telemetry.environment_update_interval 120 \\
  --set telemetry.device_update_interval 120`}
                </code>
                <CopyButton text={`python -m meshtastic --set lora.region EU_433 --set device.role TRACKER --set power.ls_secs 300 --set power.is_power_saving true --set gps.enabled true --set gps.update_interval 30 --set telemetry.environment_update_interval 120 --set telemetry.device_update_interval 120`} />
              </div>
            </div>

            {/* Tips grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <Antenna className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Модем LongModerate</p>
                  <p>~10 км на открытой, ~3-5 км в лесу. Для густого леса — VeryLongFast.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <TreePine className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Антенна вертикально</p>
                  <p>Не кладите на землю. Чем выше — тем лучше. Привяжите к рюкзаку или дереву.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <BatteryCharging className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">Автономность</p>
                  <p>TRACKER + power_saving: ~3-5 дней при GPS каждые 30 сек. Увеличьте интервал до 60 сек для дольше.</p>
                </div>
              </div>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50">
                <MapPin className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-foreground mb-0.5">GPS в лесу</p>
                  <p>Точность 10-30 м (вместо 3-5 м на открытом). Холодный старт 2-5 мин. Синий LED = фиксация.</p>
                </div>
              </div>
            </div>

            {/* Mesh & sleep explanation */}
            <Alert className="border-purple-300/50 bg-purple-50/50 dark:bg-purple-950/20">
              <AlertTriangle className="h-4 w-4 text-purple-600" />
              <AlertTitle className="text-sm">Mesh и спящие узлы</AlertTitle>
              <AlertDescription className="text-xs text-purple-800 dark:text-purple-200">
                Спящий трекер <strong>не ретранслирует</strong> пакеты. ROUTER и REPEATER всегда бодрствуют.
                Устанавливайте <strong>разные интервалы сна</strong> на трекерах — выше шанс, что хотя бы один
                бодрствует для ретрансляции.
              </AlertDescription>
            </Alert>

            {/* All commands copy-paste */}
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Все команды одной копией</h4>
              <div className="flex items-start gap-2">
                <code className="text-[11px] font-mono bg-muted p-3 rounded leading-relaxed flex-1 whitespace-pre-wrap max-h-48 overflow-y-auto">
{`# 1. Установить регион
python -m meshtastic --set lora.region EU_433

# 2. Настроить роли
python -m meshtastic --set device.role ROUTER      # Base Station
python -m meshtastic --set device.role REPEATER     # Ретранслятор
python -m meshtastic --set device.role TRACKER --set power.ls_secs 300   # Трекер 5 мин
python -m meshtastic --set device.role TRACKER --set power.ls_secs 2700  # Трекер 45 мин

# 3. Настроить GPS и телеметрию
python -m meshtastic --set gps.enabled true --set gps.update_interval 30
python -m meshtastic --set telemetry.environment_update_interval 120
python -m meshtastic --set telemetry.device_update_interval 120
python -m meshtastic --set power.is_power_saving true

# 4. Проверить настройки
python -m meshtastic --info`}
                </code>
                <CopyButton text={`# 1. Установить регион\npython -m meshtastic --set lora.region EU_433\n\n# 2. Настроить роли\npython -m meshtastic --set device.role ROUTER\npython -m meshtastic --set device.role REPEATER\npython -m meshtastic --set device.role TRACKER --set power.ls_secs 300\npython -m meshtastic --set device.role TRACKER --set power.ls_secs 2700\n\n# 3. Настроить GPS и телеметрию\npython -m meshtastic --set gps.enabled true --set gps.update_interval 30\npython -m meshtastic --set telemetry.environment_update_interval 120\npython -m meshtastic --set telemetry.device_update_interval 120\npython -m meshtastic --set power.is_power_saving true\n\n# 4. Проверить настройки\npython -m meshtastic --info`} />
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
