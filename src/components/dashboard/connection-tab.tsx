'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  Save,
  Cable,
  Radio,
  ChevronDown,
  ChevronUp,
  MonitorSmartphone,
  TreePine,
  MapPin,
  BatteryCharging,
  Antenna,
  Zap,
  Globe,
  Smartphone,
  Cpu,
  Settings,
  Check,
  ArrowRight,
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

// ---------------------------------------------------------------------------
// Step indicator component
// ---------------------------------------------------------------------------

function StepIndicator({ step, title, completed, active }: { step: number; title: string; completed: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`rounded-full h-7 w-7 flex items-center justify-center text-xs font-bold shrink-0 ${
        completed ? 'bg-green-500 text-white' : active ? 'bg-teal-500 text-white' : 'bg-muted text-muted-foreground'
      }`}>
        {completed ? <Check className="h-4 w-4" /> : step}
      </div>
      <span className={`font-semibold text-sm ${active ? 'text-foreground' : 'text-muted-foreground'}`}>
        {title}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface ConnectionTabProps {
  onSyncComplete?: () => void
}

export default function ConnectionTab({ onSyncComplete }: ConnectionTabProps) {
  const [config, setConfig] = useState<ConnectionConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSerialGuide, setShowSerialGuide] = useState(false)
  const [showMqttGuide, setShowMqttGuide] = useState(false)
  const [showForestGuide, setShowForestGuide] = useState(true)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/meshtastic/sync')
      if (res.ok) {
        const data = await res.json()
        setConfig(data)
      }
    } catch (err) {
      console.error('Failed to load config:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

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
    toast({ title: 'Скачивание', description: 'Скрипт techo-bridge.py загружается' })
  }

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    toast({ title: 'Скопировано', description: 'Команда скопирована в буфер обмена' })
  }

  const handleTestSync = async () => {
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
        toast({ title: 'Тест успешен', description: 'Тестовый узел добавлен через API синхронизации' })
        onSyncComplete?.()
      }
    } catch {
      toast({ title: 'Ошибка', description: 'Не удалось выполнить тест', variant: 'destructive' })
    }
  }

  const updateConfig = (updates: Partial<ConnectionConfig>) => {
    setConfig(prev => prev ? { ...prev, ...updates } : prev)
  }

  const toggleStep = (step: number) => {
    setCompletedSteps(prev => {
      const next = new Set(prev)
      if (next.has(step)) {
        next.delete(step)
      } else {
        next.add(step)
      }
      return next
    })
  }

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
    <div className="space-y-6">
      {/* ── Connection Status Banner ── */}
      <Card className={config?.status === 'connected' ? 'border-green-300 dark:border-green-800' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <currentStatus.icon className={`h-5 w-5 ${currentStatus.color}`} />
              <div>
                <p className="font-medium">Статус подключения</p>
                <p className="text-sm text-muted-foreground">
                  {currentStatus.label}
                  {config?.lastSync && (
                    <> · Последняя синхронизация: {new Date(config.lastSync).toLocaleString('ru')}</>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleTestSync} className="gap-1.5">
                <Radio className="h-3.5 w-3.5" />
                Тест API
              </Button>
              <Button variant="outline" size="sm" onClick={loadConfig} className="gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" />
                Обновить
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── FOREST TRACKER SETUP GUIDE (433 MHz) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Card className="border-green-300 dark:border-green-800">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <TreePine className="h-5 w-5 text-green-600" />
              Настройка трекеров 433 МГц в лесу
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForestGuide(!showForestGuide)}
              className="gap-1"
            >
              {showForestGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {showForestGuide ? 'Свернуть' : 'Развернуть'}
            </Button>
          </div>
          <CardDescription>
            Пошаговая инструкция: настройка новых T-Echo на 433 МГц для лесного трекинга
          </CardDescription>
        </CardHeader>

        {showForestGuide && (
          <CardContent className="space-y-6 border-t pt-4">
            {/* 433 MHz advantage banner */}
            <Alert className="border-green-500/50 bg-green-50 dark:bg-green-950/20">
              <Radio className="h-4 w-4 text-green-600" />
              <AlertTitle>433 МГц — отличный выбор для леса!</AlertTitle>
              <AlertDescription className="text-green-800 dark:text-green-200">
                Частота 433 МГц (диапазон LPD433) <strong>лучше проникает сквозь деревья и листву</strong>, чем 868 МГц.
                На этой частоте дальность в лесу на 40–60% больше. Для России это легальный диапазон
                (LPD-радиостанции, до 10 мВт).
              </AlertDescription>
            </Alert>

            {/* Architecture overview */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Settings className="h-4 w-4 text-teal-500" />
                Архитектура сети
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="flex items-start gap-2 p-2 rounded bg-background">
                  <Cable className="h-5 w-5 text-teal-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Base Station</p>
                    <Badge variant="default" className="text-[10px] mb-1">ROUTER</Badge>
                    <p className="text-xs text-muted-foreground">Подключён к ПК по USB. Шлюз в дашборд. Не спит.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-background">
                  <Radio className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Repeater</p>
                    <Badge variant="secondary" className="text-[10px] mb-1">REPEATER</Badge>
                    <p className="text-xs text-muted-foreground">На холме/дереве. Ретранслирует между спящими. Не спит.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-background">
                  <MapPin className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Tracker Alpha</p>
                    <Badge variant="destructive" className="text-[10px] mb-1">TRACKER</Badge>
                    <p className="text-xs text-muted-foreground">В лесу. GPS + телеметрия. Спит.</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 p-2 rounded bg-background">
                  <MapPin className="h-5 w-5 text-green-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium text-sm">Tracker Bravo</p>
                    <Badge variant="destructive" className="text-[10px] mb-1">TRACKER</Badge>
                    <p className="text-xs text-muted-foreground">В лесу. GPS + телеметрия. Спит.</p>
                  </div>
                </div>
              </div>
              {/* Mesh & Sleep explanation */}
              <Alert className="border-purple-300/50 bg-purple-50/50 dark:bg-purple-950/20 mt-2">
                <AlertTriangle className="h-4 w-4 text-purple-600" />
                <AlertTitle className="text-sm">Mesh и спящие узлы</AlertTitle>
                <AlertDescription className="text-xs text-purple-800 dark:text-purple-200">
                  Спящий трекер <strong>не ретранслирует</strong> чужие пакеты. Mesh-сеть работает, потому что ROUTER
                  и REPEATER <strong>всегда бодрствуют</strong>. Для надёжной связи устанавливайте <strong>разные интервалы
                  сна</strong> на трекерах — это увеличивает шанс, что хотя бы один бодрствует для ретрансляции.
                </AlertDescription>
              </Alert>
            </div>

            <Separator />

            {/* ── Step 1: Flash firmware ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={1} title="Прошивка Meshtastic" completed={completedSteps.has(1)} active={!completedSteps.has(1)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(1)} className="text-xs">
                  {completedSteps.has(1) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Если на T-Echo ещё нет Meshtastic — прошейте его. Для новых устройств это обязательный шаг.
                </p>
                <p className="text-sm font-medium">Способ А — Через телефон (рекомендуется):</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 ml-4">
                  <li>Скачайте приложение <strong>Meshtastic</strong> (Android / iOS)</li>
                  <li>Включите T-Echo (удерживайте кнопку питания 3 секунды)</li>
                  <li>В приложении нажмите <strong>«+»</strong> → найдите T-Echo по Bluetooth</li>
                  <li>Приложение предложит прошить устройство — <strong>согласитесь</strong></li>
                  <li>Дождитесь завершения прошивки (~2 минуты)</li>
                </ol>
                <p className="text-sm font-medium mt-2">Способ Б — Через компьютер (USB):</p>
                <div className="relative">
                  <code className="block bg-muted p-2 rounded text-sm font-mono">
                    pip install meshtastic && python -m meshtastic --flash
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('pip install meshtastic && python -m meshtastic --flash')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20 mt-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800 dark:text-amber-200 text-xs">
                    Для T-Echo нужна версия прошивки не ниже 2.3.x. Проверьте: <code className="bg-background px-1 rounded">python -m meshtastic --info</code>
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <Separator />

            {/* ── Step 2: Set Region to EU_433 ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={2} title="Установите регион EU_433" completed={completedSteps.has(2)} active={completedSteps.has(1) && !completedSteps.has(2)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(2)} className="text-xs">
                  {completedSteps.has(2) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-2">
                <Alert className="border-red-500/50 bg-red-50 dark:bg-red-950/20">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <AlertTitle>Критически важно!</AlertTitle>
                  <AlertDescription className="text-red-800 dark:text-red-200">
                    Все устройства должны иметь <strong>одинаковый регион</strong>. Если регион разный — устройства
                    <strong> не увидят друг друга</strong>, даже если стоят рядом!
                  </AlertDescription>
                </Alert>
                <p className="text-sm text-muted-foreground">
                  Для 433 МГц выбирайте <strong>EU_433</strong> (LPD433). Не путайте с EU_868 или RU_868!
                </p>
                <p className="text-sm font-medium">Через приложение:</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 ml-4">
                  <li>Подключитесь к T-Echo по Bluetooth</li>
                  <li>Device Settings → LoRa → Region</li>
                  <li>Выберите <strong>EU_433</strong></li>
                </ol>
                <p className="text-sm font-medium mt-2">Через компьютер (USB):</p>
                <div className="relative">
                  <code className="block bg-muted p-2 rounded text-sm font-mono">
                    python -m meshtastic --set lora.region EU_433
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('python -m meshtastic --set lora.region EU_433')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  ⚠️ Повторите на КАЖДОМ устройстве! Сначала на Base Station, потом на трекерах.
                </p>
              </div>
            </div>

            <Separator />

            {/* ── Step 3: Create Private Channel ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={3} title="Создайте приватный канал" completed={completedSteps.has(3)} active={completedSteps.has(2) && !completedSteps.has(3)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(3)} className="text-xs">
                  {completedSteps.has(3) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Приватный канал с общим ключом (PSK) объединяет устройства в одну сеть. Без него все видят
                  только «общий» канал с помехами.
                </p>

                <p className="text-sm font-medium">На первом устройстве (Base Station):</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5 ml-4">
                  <li>В приложении Meshtastic → <strong>Channel Settings</strong></li>
                  <li>Нажмите <strong>«+ New channel»</strong></li>
                  <li>Тип: <strong>Private / Encrypted</strong></li>
                  <li>Название: <code className="bg-muted px-1 rounded">forest-track</code></li>
                  <li>Модем: <strong>LongModerate</strong> (рекомендуется для смешанного леса)</li>
                  <li>Нажмите <strong>Share → QR Code</strong></li>
                </ol>

                <p className="text-sm font-medium mt-3">На трекерах Alpha и Bravo:</p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5 ml-4">
                  <li>Подключитесь к трекеру по Bluetooth</li>
                  <li>Нажмите <strong>Scan QR</strong></li>
                  <li>Отсканируйте QR-код с Base Station</li>
                  <li>Канал, PSK и настройки применятся автоматически</li>
                </ol>

                <p className="text-sm font-medium mt-3">Или через компьютер (USB) на Base Station:</p>
                <div className="relative">
                  <code className="block bg-muted p-2 rounded text-xs font-mono break-all">
                    python -m meshtastic --ch-add forest-track --ch-set psk --ch-set modem_preset LongModerate
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('python -m meshtastic --ch-add forest-track --ch-set psk --ch-set modem_preset LongModerate')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>

            <Separator />

            {/* ── Step 4: Set Roles ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={4} title="Настройте роли устройств" completed={completedSteps.has(4)} active={completedSteps.has(3) && !completedSteps.has(4)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(4)} className="text-xs">
                  {completedSteps.has(4) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <Card className="bg-muted/50 border-teal-200 dark:border-teal-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Cable className="h-4 w-4 text-teal-500" />
                      <span className="font-medium text-sm">Base Station</span>
                    </div>
                    <Badge variant="default" className="text-xs mb-1">ROUTER</Badge>
                    <p className="text-xs text-muted-foreground">Подключён к ПК по USB. Ретранслирует пакеты. Не спит — всегда на связи.</p>
                    <div className="relative mt-2">
                      <code className="block bg-background p-1.5 rounded text-xs font-mono">
                        python -m meshtastic --set device.role ROUTER
                      </code>
                      <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6"
                        onClick={() => handleCopyCommand('python -m meshtastic --set device.role ROUTER')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50/30 dark:bg-amber-950/10 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Radio className="h-4 w-4 text-amber-500" />
                      <span className="font-medium text-sm">Repeater</span>
                    </div>
                    <Badge variant="secondary" className="text-xs mb-1">REPEATER</Badge>
                    <p className="text-xs text-muted-foreground">На возвышенности. Только ретрансляция — заполняет пробелы в mesh. Не спит, нужен стационар.</p>
                    <div className="relative mt-2">
                      <code className="block bg-background p-1.5 rounded text-xs font-mono">
                        python -m meshtastic --set device.role REPEATER
                      </code>
                      <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6"
                        onClick={() => handleCopyCommand('python -m meshtastic --set device.role REPEATER')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">Tracker Alpha</span>
                    </div>
                    <Badge variant="destructive" className="text-xs mb-1">TRACKER</Badge>
                    <p className="text-xs text-muted-foreground">Спит 5 мин, бодрствует 10 сек. Шлёт GPS + телеметрию.</p>
                    <div className="relative mt-2">
                      <code className="block bg-background p-1.5 rounded text-[10px] font-mono leading-relaxed">
                        python -m meshtastic --set device.role TRACKER --set power.ls_secs 300
                      </code>
                      <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6"
                        onClick={() => handleCopyCommand('python -m meshtastic --set device.role TRACKER --set power.ls_secs 300')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-muted/50">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="h-4 w-4 text-green-500" />
                      <span className="font-medium text-sm">Tracker Bravo</span>
                    </div>
                    <Badge variant="destructive" className="text-xs mb-1">TRACKER</Badge>
                    <p className="text-xs text-muted-foreground">Спит 45 мин, бодрствует 10 сек. Другой интервал = лучше mesh.</p>
                    <div className="relative mt-2">
                      <code className="block bg-background p-1.5 rounded text-[10px] font-mono leading-relaxed">
                        python -m meshtastic --set device.role TRACKER --set power.ls_secs 2700
                      </code>
                      <Button variant="ghost" size="icon" className="absolute top-0.5 right-0.5 h-6 w-6"
                        onClick={() => handleCopyCommand('python -m meshtastic --set device.role TRACKER --set power.ls_secs 2700')}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div className="ml-9">
                <p className="text-xs text-muted-foreground">
                  Или через приложение: Device Settings → Device Role → ROUTER / REPEATER / TRACKER
                </p>
                <Alert className="border-amber-300/50 bg-amber-50/50 dark:bg-amber-950/20 mt-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                  <AlertDescription className="text-[10px] text-amber-800 dark:text-amber-200">
                    <strong>Разные интервалы сна</strong> на трекерах — ключ к надёжной mesh-связи!
                    Если Tracker Alpha спит 5 мин, а Bravo — 45 мин, выше шанс, что хотя бы один
                    бодрствует, когда другой передаёт данные.
                  </AlertDescription>
                </Alert>
              </div>
            </div>

            <Separator />

            {/* ── Step 5: GPS Settings for Forest ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={5} title="Настройте GPS на трекерах" completed={completedSteps.has(5)} active={completedSteps.has(4) && !completedSteps.has(5)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(5)} className="text-xs">
                  {completedSteps.has(5) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-2">
                <p className="text-sm text-muted-foreground">
                  T-Echo имеет встроенный GPS-модуль. В лесу GPS работает хуже из-за кроны деревьев.
                  Настройте частоту обновления:
                </p>
                <div className="relative">
                  <code className="block bg-muted p-2 rounded text-sm font-mono">
                    python -m meshtastic --set gps.enabled true --set gps.update_interval 30
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('python -m meshtastic --set gps.enabled true --set gps.update_interval 30')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ul className="text-sm text-muted-foreground list-disc list-inside ml-4 space-y-1">
                  <li><strong>update_interval: 30</strong> — обновлять GPS каждые 30 сек (баланс батареи/точности)</li>
                  <li>В густом лесу «холодный старт» GPS может занять 2–5 минут</li>
                  <li>На открытых полянах позиция восстановится за 10–30 сек</li>
                  <li>Синий светодиод на T-Echo = GPS фиксирует позицию</li>
                  <li>Если GPS потерян — T-Echo отправит последнюю известную позицию</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* ── Step 6: Optimize for Forest ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={6} title="Оптимизируйте настройки для леса" completed={completedSteps.has(6)} active={completedSteps.has(5) && !completedSteps.has(6)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(6)} className="text-xs">
                  {completedSteps.has(6) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Дополнительные настройки для улучшения работы в лесу на 433 МГц:
                </p>
                <div className="relative">
                  <code className="block bg-muted p-2 rounded text-xs font-mono break-all">
                    python -m meshtastic --set telemetry.environment_update_interval 120 --set telemetry.device_update_interval 120 --set power.is_power_saving true
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('python -m meshtastic --set telemetry.environment_update_interval 120 --set telemetry.device_update_interval 120 --set power.is_power_saving true')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <ul className="text-sm text-muted-foreground list-disc list-inside ml-4 space-y-1">
                  <li><strong>environment_update_interval: 120</strong> — телеметрия (температура, влажность) каждые 2 мин</li>
                  <li><strong>device_update_interval: 120</strong> — данные устройства (батарея, напряжение) каждые 2 мин</li>
                  <li><strong>is_power_saving: true</strong> — режим экономии энергии (спит между передачами)</li>
                </ul>
              </div>
            </div>

            <Separator />

            {/* ── Step 7: Connect Base Station to Dashboard ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={7} title="Подключите Base Station к дашборду" completed={completedSteps.has(7)} active={completedSteps.has(6) && !completedSteps.has(7)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(7)} className="text-xs">
                  {completedSteps.has(7) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Подключите Base Station к ПК по USB и запустите скрипт-мост:
                </p>
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 ml-4">
                  <li>Подключите T-Echo (Base Station) к компьютеру по USB</li>
                  <li>Проверьте, что устройство определилось:</li>
                </ol>
                <div className="relative ml-8">
                  <code className="block bg-muted p-2 rounded text-sm font-mono">
                    python -m meshtastic --info
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('python -m meshtastic --info')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground ml-8">3. Установите зависимости и запустите скрипт:</p>
                <div className="relative ml-8">
                  <code className="block bg-muted p-2 rounded text-sm font-mono break-all">
                    pip install meshtastic requests && python techo-bridge.py --mode serial --port /dev/ttyUSB0 --dashboard http://localhost:3000
                  </code>
                  <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-7 w-7"
                    onClick={() => handleCopyCommand('pip install meshtastic requests && python techo-bridge.py --mode serial --port /dev/ttyUSB0 --dashboard http://localhost:3000')}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground ml-8">
                  Linux: <code>/dev/ttyUSB0</code> · macOS: <code>/dev/cu.usbmodem*</code> · Windows: <code>COM3</code>
                </p>
                <p className="text-sm text-muted-foreground ml-8 mt-2">
                  4. Скрипт автоматически обнаружит все 3 устройства в mesh-сети и начнёт передавать данные в дашборд.
                </p>
              </div>
            </div>

            <Separator />

            {/* ── Step 8: Verify ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <StepIndicator step={8} title="Проверьте работу" completed={completedSteps.has(8)} active={completedSteps.has(7) && !completedSteps.has(8)} />
                <Button variant="ghost" size="sm" onClick={() => toggleStep(8)} className="text-xs">
                  {completedSteps.has(8) ? 'Отменить' : 'Готово'}
                </Button>
              </div>
              <div className="ml-9 space-y-2">
                <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 ml-4">
                  <li>Откройте вкладку <strong>«Статус»</strong> — все 3 устройства должны появиться</li>
                  <li>Откройте вкладку <strong>«Карта»</strong> — позиции трекеров на карте</li>
                  <li>Убедитесь, что SNR &gt; 0 и RSSI &gt; -120 дБм (хороший сигнал)</li>
                  <li>Выйдите с трекером на улицу и проверьте обновление позиции</li>
                </ol>
              </div>
            </div>

            <Separator />

            {/* ── Forest-specific tips for 433 MHz ── */}
            <div className="space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Antenna className="h-4 w-4 text-amber-500" />
                Советы для лесного трекинга на 433 МГц
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 ml-4">
                <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-1.5">
                      <Antenna className="h-3.5 w-3.5 text-amber-600" />
                      Модем LongModerate
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Для смешанного леса оптимальный пресет — <strong>LongModerate</strong>. Дальность на 433 МГц: ~10 км
                      на открытой местности, ~3–5 км в густом лесу. Если лес очень густой — попробуйте VeryLongFast.
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-1.5">
                      <TreePine className="h-3.5 w-3.5 text-amber-600" />
                      Позиция антенны
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Держите T-Echo <strong>вертикально</strong> (антенной вверх). Не кладите на землю.
                      Чем выше антенна — тем лучше сигнал. Привяжите к рюкзаку или дереву.
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-1.5">
                      <BatteryCharging className="h-3.5 w-3.5 text-amber-600" />
                      Автономность
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Роль TRACKER + power_saving: батарея T-Echo (~1000 мАч) держится <strong>3–5 дней</strong> при
                      GPS-обновлении каждые 30 сек. Для ещё большей автономности увеличьте интервал до 60 сек.
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-amber-600" />
                      GPS в лесу
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      Точность GPS в лесу: 10–30 м вместо 3–5 м на открытом небе.
                      Хвойный лес хуже для GPS, чем лиственный. После выхода на поляну точность восстановится за 10–30 сек.
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-1.5">
                      <Radio className="h-3.5 w-3.5 text-green-600" />
                      Преимущество 433 МГц
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      433 МГц лучше проникает сквозь деревья, чем 868 МГц. Дальность в лесу на 40–60% больше.
                      Диапазон LPD433 легален в России (до 10 мВт мощность).
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                  <CardContent className="p-3">
                    <h5 className="font-medium text-sm mb-1 flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-600" />
                      Помехи
                    </h5>
                    <p className="text-xs text-muted-foreground">
                      433 МГц — популярный диапазон (дверные звонки, метеостанции). Если много помех —
                      смените канал на приватный с уникальным PSK. Модем LongModerate устойчивее к помехам.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* ── Quick reference command card ── */}
            <Card className="border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
              <CardContent className="p-4">
                <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-teal-600" />
                  Быстрая настройка нового T-Echo (все команды)
                </h4>
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-medium">Подключите T-Echo по USB и выполните:</p>
                  <div className="relative">
                    <code className="block bg-background p-3 rounded text-xs font-mono leading-relaxed whitespace-pre">
{`# 1. Регион 433 МГц
python -m meshtastic --set lora.region EU_433

# 2. Роль TRACKER (для лесных трекеров)
python -m meshtastic --set device.role TRACKER

# 3. GPS включён, обновление каждые 30 сек
python -m meshtastic --set gps.enabled true --set gps.update_interval 30

# 4. Экономия батареи + интервал сна
python -m meshtastic --set power.is_power_saving true \\
  --set power.ls_secs 300 --set power.min_wake_secs 10

# 5. Телеметрия каждые 2 мин
python -m meshtastic --set telemetry.environment_update_interval 120 \\
  --set telemetry.device_update_interval 120

# ═══ Для REPEATER (на холме/дереве) ═══
# python -m meshtastic --set device.role REPEATER
# ═══ Для ROUTER (Base Station) ═══
# python -m meshtastic --set device.role ROUTER`}
                    </code>
                    <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopyCommand(`python -m meshtastic --set lora.region EU_433\npython -m meshtastic --set device.role TRACKER\npython -m meshtastic --set gps.enabled true --set gps.update_interval 30\npython -m meshtastic --set power.is_power_saving true\npython -m meshtastic --set telemetry.environment_update_interval 120 --set telemetry.device_update_interval 120`)}>
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Для <strong>ROUTER</strong>: замените TRACKER на ROUTER и уберите power_saving.<br/>
                    Для <strong>REPEATER</strong>: замените TRACKER на REPEATER, уберите power_saving и GPS.<br/>
                    <strong>Разные ls_secs</strong> на трекерах = надёжнее mesh!
                  </p>
                </div>
              </CardContent>
            </Card>
          </CardContent>
        )}
      </Card>

      {/* ── Two Methods ── */}
      <Tabs defaultValue="serial">
        <TabsList className="w-full">
          <TabsTrigger value="serial" className="flex-1 gap-1.5">
            <Cable className="h-4 w-4" />
            USB / Serial
          </TabsTrigger>
          <TabsTrigger value="mqtt" className="flex-1 gap-1.5">
            <Wifi className="h-4 w-4" />
            MQTT
          </TabsTrigger>
        </TabsList>

        {/* ── Serial Method ── */}
        <TabsContent value="serial" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Usb className="h-5 w-5 text-teal-500" />
                  Подключение через USB
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSerialGuide(!showSerialGuide)}
                  className="gap-1"
                >
                  {showSerialGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Инструкция
                </Button>
              </div>
              <CardDescription>
                Подключите T-Echo к компьютеру по USB и запустите скрипт-мост
              </CardDescription>
            </CardHeader>

            {showSerialGuide && (
              <CardContent className="space-y-4 border-t pt-4">
                <Alert className="border-teal-500/50 bg-teal-50 dark:bg-teal-950/20">
                  <MonitorSmartphone className="h-4 w-4 text-teal-600" />
                  <AlertTitle>Как это работает</AlertTitle>
                  <AlertDescription className="text-teal-800 dark:text-teal-200">
                    Python-скрипт подключается к T-Echo через USB, считывает данные всех узлов в mesh-сети
                    и отправляет их в дашборд. Одно устройство выступает шлюзом для всей сети.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Шаг 1: Установите Python-зависимости</h4>
                  <div className="relative">
                    <code className="block bg-muted p-3 rounded-md text-sm font-mono">
                      pip install meshtastic requests
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopyCommand('pip install meshtastic requests')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Шаг 2: Подключите T-Echo по USB</h4>
                  <div className="relative">
                    <code className="block bg-muted p-3 rounded-md text-sm font-mono">
                      python -m meshtastic --info
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopyCommand('python -m meshtastic --info')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Шаг 3: Скачайте и запустите скрипт</h4>
                  <Button onClick={handleDownloadScript} className="gap-1.5 mb-2">
                    <Download className="h-4 w-4" />
                    Скачать techo-bridge.py
                  </Button>
                  <div className="relative">
                    <code className="block bg-muted p-3 rounded-md text-sm font-mono break-all">
                      python techo-bridge.py --mode serial --port /dev/ttyUSB0 --dashboard http://localhost:3000
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopyCommand('python techo-bridge.py --mode serial --port /dev/ttyUSB0 --dashboard http://localhost:3000')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Serial Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Настройки Serial</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="serial-port">Serial порт</Label>
                  <Input
                    id="serial-port"
                    placeholder="/dev/ttyUSB0"
                    value={config?.serialPort || ''}
                    onChange={(e) => updateConfig({ serialPort: e.target.value, type: 'serial' })}
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    Linux: /dev/ttyUSB0 · macOS: /dev/cu.usbmodem · Windows: COM3
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Интервал опроса</Label>
                  <Input
                    value="30 сек"
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Настраивается в скрипте: --interval 30
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Включить подключение</Label>
                  {config?.isEnabled && config.type === 'serial' && (
                    <Badge variant="default" className="bg-green-500 text-xs">Активно</Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MQTT Method ── */}
        <TabsContent value="mqtt" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wifi className="h-5 w-5 text-teal-500" />
                  Подключение через MQTT
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMqttGuide(!showMqttGuide)}
                  className="gap-1"
                >
                  {showMqttGuide ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  Инструкция
                </Button>
              </div>
              <CardDescription>
                Используйте MQTT-брокер для получения данных через WiFi
              </CardDescription>
            </CardHeader>

            {showMqttGuide && (
              <CardContent className="space-y-4 border-t pt-4">
                <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertTitle>Требование</AlertTitle>
                  <AlertDescription className="text-amber-800 dark:text-amber-200">
                    Для MQTT хотя бы одно устройство должно быть подключено к WiFi и настроено на MQTT-брокер.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Шаг 1: Настройте T-Echo для MQTT</h4>
                  <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1 ml-2">
                    <li>Подключитесь к T-Echo по Bluetooth</li>
                    <li>Module Settings → MQTT → Включите MQTT</li>
                    <li>Адрес брокера: <code className="bg-muted px-1 rounded">mqtt.meshtastic.org</code></li>
                    <li>Включите MQTT encryption</li>
                  </ol>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold text-sm">Шаг 2: Запустите MQTT-мост</h4>
                  <div className="relative">
                    <code className="block bg-muted p-3 rounded-md text-sm font-mono break-all">
                      python techo-bridge.py --mode mqtt --broker mqtt://mqtt.meshtastic.org:1883 --dashboard http://localhost:3000
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopyCommand('python techo-bridge.py --mode mqtt --broker mqtt://mqtt.meshtastic.org:1883 --dashboard http://localhost:3000')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* MQTT Config */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Настройки MQTT</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mqtt-broker">MQTT брокер</Label>
                <Input
                  id="mqtt-broker"
                  placeholder="mqtt.meshtastic.org:1883"
                  value={config?.mqttBroker || ''}
                  onChange={(e) => updateConfig({ mqttBroker: e.target.value, type: 'mqtt' })}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mqtt-topic">MQTT топик</Label>
                <Input
                  id="mqtt-topic"
                  placeholder="msh/EU_433/#"
                  value={config?.mqttTopic || ''}
                  onChange={(e) => updateConfig({ mqttTopic: e.target.value })}
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Для 433 МГц используйте <code className="bg-muted px-1 rounded">msh/EU_433/#</code>
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mqtt-user">Имя пользователя (опционально)</Label>
                  <Input
                    id="mqtt-user"
                    placeholder="username"
                    value={config?.mqttUsername || ''}
                    onChange={(e) => updateConfig({ mqttUsername: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mqtt-pass">Пароль (опционально)</Label>
                  <Input
                    id="mqtt-pass"
                    type="password"
                    placeholder="password"
                    value={config?.mqttPassword || ''}
                    onChange={(e) => updateConfig({ mqttPassword: e.target.value })}
                  />
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Включить подключение</Label>
                  {config?.isEnabled && config.type === 'mqtt' && (
                    <Badge variant="default" className="bg-green-500 text-xs">Активно</Badge>
                  )}
                </div>
                <Button
                  size="sm"
                  className="gap-1.5"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Сохранить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Download Script Card ── */}
      <Card className="border-teal-300 dark:border-teal-800 bg-teal-50/50 dark:bg-teal-950/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-500/10">
                <Download className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-medium text-sm">Скрипт-мост techo-bridge.py</p>
                <p className="text-xs text-muted-foreground">
                  Python-скрипт для связи T-Echo с дашбордом по USB или MQTT
                </p>
              </div>
            </div>
            <Button onClick={handleDownloadScript} variant="outline" className="gap-1.5">
              <Download className="h-4 w-4" />
              Скачать скрипт
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
