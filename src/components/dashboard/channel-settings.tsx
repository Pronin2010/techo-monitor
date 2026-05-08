'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Channel } from '@/lib/types'
import { MODEM_PRESETS, REGIONS } from '@/lib/types'
import type { ModemPreset, Region } from '@/lib/types'
import QRCode from 'qrcode'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { Radio, QrCode, Copy, RefreshCw, Plus, Trash2, Settings, Shield, Globe, Zap, Save, AlertTriangle, Eye, EyeOff, Star, Cable } from 'lucide-react'

interface ChannelSettingsProps {
  channels: Channel[]
  onUpdateChannel: (id: string, data: Partial<Channel>) => Promise<void>
  onCreateChannel: (data: Partial<Channel>) => Promise<void>
  onDeleteChannel: (id: string) => Promise<void>
  onSelectForConnection?: (channel: Channel) => void
}

function generateRandomPSK(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes))
}

function maskPSK(psk: string): string {
  if (!psk) return ''
  return '●'.repeat(Math.min(psk.length, 16))
}

function getModemPresetDescription(preset: ModemPreset): string {
  const found = MODEM_PRESETS.find(p => p.value === preset)
  return found ? found.description : ''
}

function getRegionLabel(region: Region): string {
  const found = REGIONS.find(r => r.value === region)
  return found ? found.label : region
}

export default function ChannelSettings({ channels, onUpdateChannel, onCreateChannel, onDeleteChannel, onSelectForConnection }: ChannelSettingsProps) {
  const [revealedPSKs, setRevealedPSKs] = useState<Set<string>>(new Set())
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('')
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('')
  const [qrDialogOpen, setQrDialogOpen] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingChannel, setEditingChannel] = useState<Channel | null>(null)
  const [loading, setLoading] = useState<string | null>(null)

  // Add channel form state
  const [addForm, setAddForm] = useState({
    name: '',
    psk: '',
    modemPreset: 'LONG_FAST' as ModemPreset,
    region: 'EU_433' as Region,
    frequency: '',
    uplink: true,
    downlink: true,
  })

  // Edit channel form state
  const [editForm, setEditForm] = useState({
    name: '',
    psk: '',
    modemPreset: 'LONG_FAST' as ModemPreset,
    region: 'EU_433' as Region,
    frequency: '',
    uplink: true,
    downlink: true,
  })

  const togglePSKReveal = (channelId: string) => {
    setRevealedPSKs(prev => {
      const next = new Set(prev)
      if (next.has(channelId)) {
        next.delete(channelId)
      } else {
        next.add(channelId)
      }
      return next
    })
  }

  const generateQRCode = useCallback(async (channel: Channel) => {
    try {
      const url = `https://meshtastic.org/e/#channel-index=${channel.index}&channel-name=${channel.name}&channel-psk=${channel.psk}&modem-preset=${channel.modemPreset}`
      setQrCodeUrl(url)
      const dataUrl = await QRCode.toDataURL(url, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      })
      setQrCodeDataUrl(dataUrl)
      setQrDialogOpen(true)
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось сгенерировать QR-код',
        variant: 'destructive',
      })
    }
  }, [])

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(qrCodeUrl)
      toast({
        title: 'Скопировано',
        description: 'Ссылка на канал скопирована в буфер обмена',
      })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось скопировать ссылку',
        variant: 'destructive',
      })
    }
  }

  const handleGeneratePSK = (isEdit: boolean) => {
    const psk = generateRandomPSK()
    if (isEdit) {
      setEditForm(prev => ({ ...prev, psk }))
    } else {
      setAddForm(prev => ({ ...prev, psk }))
    }
  }

  const handleCreateChannel = async () => {
    if (!addForm.name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название канала',
        variant: 'destructive',
      })
      return
    }
    if (!addForm.psk.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите или сгенерируйте PSK',
        variant: 'destructive',
      })
      return
    }

    setLoading('create')
    try {
      await onCreateChannel({
        name: addForm.name.trim(),
        psk: addForm.psk.trim(),
        modemPreset: addForm.modemPreset,
        region: addForm.region,
        frequency: addForm.frequency ? parseFloat(addForm.frequency) : null,
        uplink: addForm.uplink,
        downlink: addForm.downlink,
      })
      toast({
        title: 'Канал создан',
        description: `Канал "${addForm.name}" успешно создан`,
      })
      setAddForm({
        name: '',
        psk: '',
        modemPreset: 'LONG_FAST',
        region: 'EU_433',
        frequency: '',
        uplink: true,
        downlink: true,
      })
      setAddDialogOpen(false)
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось создать канал',
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  const handleUpdateChannel = async () => {
    if (!editingChannel) return
    if (!editForm.name.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите название канала',
        variant: 'destructive',
      })
      return
    }
    if (!editForm.psk.trim()) {
      toast({
        title: 'Ошибка',
        description: 'Введите или сгенерируйте PSK',
        variant: 'destructive',
      })
      return
    }

    setLoading(`edit-${editingChannel.id}`)
    try {
      await onUpdateChannel(editingChannel.id, {
        name: editForm.name.trim(),
        psk: editForm.psk.trim(),
        modemPreset: editForm.modemPreset,
        region: editForm.region,
        frequency: editForm.frequency ? parseFloat(editForm.frequency) : null,
        uplink: editForm.uplink,
        downlink: editForm.downlink,
      })
      toast({
        title: 'Канал обновлён',
        description: `Канал "${editForm.name}" успешно обновлён`,
      })
      setEditDialogOpen(false)
      setEditingChannel(null)
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось обновить канал',
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  const handleDeleteChannel = async (channel: Channel) => {
    if (channel.isDefault) return

    setLoading(`delete-${channel.id}`)
    try {
      await onDeleteChannel(channel.id)
      toast({
        title: 'Канал удалён',
        description: `Канал "${channel.name}" успешно удалён`,
      })
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось удалить канал',
        variant: 'destructive',
      })
    } finally {
      setLoading(null)
    }
  }

  const openEditDialog = (channel: Channel) => {
    setEditingChannel(channel)
    setEditForm({
      name: channel.name,
      psk: channel.psk,
      modemPreset: channel.modemPreset,
      region: channel.region,
      frequency: channel.frequency ? String(channel.frequency) : '',
      uplink: channel.uplink,
      downlink: channel.downlink,
    })
    setEditDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Warning Alert */}
      <Alert className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800 dark:text-amber-200">
          Изменение настроек канала требует перезапуска устройств для вступления в силу
        </AlertDescription>
      </Alert>

      {/* Header with Add Button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Каналы</h2>
          <Badge variant="secondary" className="ml-1">
            {channels.length}
          </Badge>
        </div>
        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" />
              Добавить канал
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Новый канал
              </DialogTitle>
              <DialogDescription>
                Создайте новый канал для вашей Meshtastic сети
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="add-name">Название канала</Label>
                <Input
                  id="add-name"
                  placeholder="Например: my-channel"
                  value={addForm.name}
                  onChange={e => setAddForm(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-psk">PSK (ключ)</Label>
                <div className="flex gap-2">
                  <Input
                    id="add-psk"
                    placeholder="Base64 ключ"
                    value={addForm.psk}
                    onChange={e => setAddForm(prev => ({ ...prev, psk: e.target.value }))}
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => handleGeneratePSK(false)}
                    title="Сгенерировать случайный ключ"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Модем пресет</Label>
                <Select
                  value={addForm.modemPreset}
                  onValueChange={(v) => setAddForm(prev => ({ ...prev, modemPreset: v as ModemPreset }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEM_PRESETS.map(preset => (
                      <SelectItem key={preset.value} value={preset.value}>
                        <div className="flex items-center gap-2">
                          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{preset.label}</span>
                          <span className="text-xs text-muted-foreground">— {preset.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Регион</Label>
                <Select
                  value={addForm.region}
                  onValueChange={(v) => setAddForm(prev => ({ ...prev, region: v as Region }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REGIONS.map(region => (
                      <SelectItem key={region.value} value={region.value}>
                        <div className="flex items-center gap-2">
                          <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                          <span>{region.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="add-frequency">Частота (МГц) — переопределение</Label>
                <Input
                  id="add-frequency"
                  type="number"
                  step="0.1"
                  min="433.0"
                  max="434.0"
                  placeholder="Авто (стандартная для региона)"
                  value={addForm.frequency}
                  onChange={e => setAddForm(prev => ({ ...prev, frequency: e.target.value }))}
                  className="font-mono text-sm"
                />
                <p className="text-[10px] text-muted-foreground">
                  Оставьте пустым для стандартной частоты региона. Например: 433.175
                </p>
              </div>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="add-uplink" className="cursor-pointer">Uplink</Label>
                  <Switch
                    id="add-uplink"
                    checked={addForm.uplink}
                    onCheckedChange={(checked) => setAddForm(prev => ({ ...prev, uplink: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="add-downlink" className="cursor-pointer">Downlink</Label>
                  <Switch
                    id="add-downlink"
                    checked={addForm.downlink}
                    onCheckedChange={(checked) => setAddForm(prev => ({ ...prev, downlink: checked }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                Отмена
              </Button>
              <Button onClick={handleCreateChannel} disabled={loading === 'create'}>
                {loading === 'create' ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Создать
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Channel Cards Grid */}
      {channels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Radio className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1">Нет каналов</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Создайте первый канал для вашей Meshtastic сети
            </p>
            <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Добавить канал
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {channels.map(channel => (
            <Card key={channel.id} className={channel.isDefault ? 'border-green-300 dark:border-green-800' : ''}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-base">{channel.name}</CardTitle>
                    {channel.isDefault ? (
                      <Badge className="bg-green-600 hover:bg-green-700 text-white gap-1">
                        <Star className="h-3 w-3" />
                        По умолчанию
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Канал {channel.index}</Badge>
                    )}
                  </div>
                  <Badge variant="outline" className="font-mono text-xs">
                    #{channel.index}
                  </Badge>
                </div>
                <CardDescription className="mt-1">
                  <span className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5" />
                    {channel.modemPreset} — {getModemPresetDescription(channel.modemPreset)}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* PSK Row */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5" />
                    PSK
                  </Label>
                  <div className="flex items-center gap-2">
                    <code className="text-sm bg-muted px-2 py-1 rounded flex-1 truncate font-mono">
                      {revealedPSKs.has(channel.id) ? channel.psk : maskPSK(channel.psk)}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      onClick={() => togglePSKReveal(channel.id)}
                      title={revealedPSKs.has(channel.id) ? 'Скрыть PSK' : 'Показать PSK'}
                    >
                      {revealedPSKs.has(channel.id) ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Region */}
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Регион:</span>
                  <span className="font-medium">{getRegionLabel(channel.region)}</span>
                </div>

                {/* Frequency */}
                {channel.frequency && (
                  <div className="flex items-center gap-2 text-sm">
                    <Radio className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Частота:</span>
                    <span className="font-mono font-medium">{channel.frequency} МГц</span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 text-amber-600">
                      override
                    </Badge>
                  </div>
                )}

                <Separator />

                {/* Uplink/Downlink */}
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${channel.uplink ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                    <span className="text-sm">Uplink</span>
                    <Badge variant={channel.uplink ? 'default' : 'secondary'} className="text-xs">
                      {channel.uplink ? 'Вкл' : 'Выкл'}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${channel.downlink ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                    <span className="text-sm">Downlink</span>
                    <Badge variant={channel.downlink ? 'default' : 'secondary'} className="text-xs">
                      {channel.downlink ? 'Вкл' : 'Выкл'}
                    </Badge>
                  </div>
                </div>

                <Separator />

                {/* Actions */}
                <div className="flex items-center gap-2 flex-wrap">
                  {onSelectForConnection && (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => onSelectForConnection(channel)}
                    >
                      <Cable className="h-3.5 w-3.5" />
                      Использовать
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => generateQRCode(channel)}
                  >
                    <QrCode className="h-3.5 w-3.5" />
                    QR-код
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={() => openEditDialog(channel)}
                    disabled={loading === `edit-${channel.id}`}
                  >
                    {loading === `edit-${channel.id}` ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Settings className="h-3.5 w-3.5" />
                    )}
                    Изменить
                  </Button>
                  {!channel.isDefault && (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="gap-1.5 ml-auto"
                      onClick={() => handleDeleteChannel(channel)}
                      disabled={loading === `delete-${channel.id}`}
                    >
                      {loading === `delete-${channel.id}` ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Удалить
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* QR Code Dialog */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR-код канала
            </DialogTitle>
            <DialogDescription>
              Отсканируйте QR-код для подключения к каналу
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            {qrCodeDataUrl ? (
              <img
                src={qrCodeDataUrl}
                alt="QR-код канала Meshtastic"
                className="rounded-lg border shadow-sm"
                width={280}
                height={280}
              />
            ) : (
              <div className="flex items-center justify-center w-[280px] h-[280px] bg-muted rounded-lg">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="w-full space-y-2">
              <Label className="text-xs text-muted-foreground">Ссылка для подключения</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={qrCodeUrl}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  onClick={copyLink}
                  title="Копировать ссылку"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Channel Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Редактирование канала
            </DialogTitle>
            <DialogDescription>
              Измените настройки канала «{editingChannel?.name}»
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Название канала</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={e => setEditForm(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-psk">PSK (ключ)</Label>
              <div className="flex gap-2">
                <Input
                  id="edit-psk"
                  value={editForm.psk}
                  onChange={e => setEditForm(prev => ({ ...prev, psk: e.target.value }))}
                  className="font-mono text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => handleGeneratePSK(true)}
                  title="Сгенерировать случайный ключ"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Модем пресет</Label>
              <Select
                value={editForm.modemPreset}
                onValueChange={(v) => setEditForm(prev => ({ ...prev, modemPreset: v as ModemPreset }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MODEM_PRESETS.map(preset => (
                    <SelectItem key={preset.value} value={preset.value}>
                      <div className="flex items-center gap-2">
                        <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{preset.label}</span>
                        <span className="text-xs text-muted-foreground">— {preset.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Регион</Label>
              <Select
                value={editForm.region}
                onValueChange={(v) => setEditForm(prev => ({ ...prev, region: v as Region }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REGIONS.map(region => (
                    <SelectItem key={region.value} value={region.value}>
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{region.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-frequency">Частота (МГц) — переопределение</Label>
              <Input
                id="edit-frequency"
                type="number"
                step="0.1"
                min="433.0"
                max="434.0"
                placeholder="Авто (стандартная для региона)"
                value={editForm.frequency}
                onChange={e => setEditForm(prev => ({ ...prev, frequency: e.target.value }))}
                className="font-mono text-sm"
              />
              <p className="text-[10px] text-muted-foreground">
                Оставьте пустым для стандартной частоты региона. Например: 433.175
              </p>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-uplink" className="cursor-pointer">Uplink</Label>
                <Switch
                  id="edit-uplink"
                  checked={editForm.uplink}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, uplink: checked }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-downlink" className="cursor-pointer">Downlink</Label>
                <Switch
                  id="edit-downlink"
                  checked={editForm.downlink}
                  onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, downlink: checked }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpdateChannel} disabled={loading === `edit-${editingChannel?.id}`}>
              {loading === `edit-${editingChannel?.id}` ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
