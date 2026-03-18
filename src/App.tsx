import React, { useState, useEffect, useRef } from 'react';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Download, Plus, List, Calendar as CalendarIcon, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { DailyLog, defaultLog } from '@/types';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface AppImportMetaEnv {
  VITE_API_BASE_URL?: string;
}

interface AppImportMeta {
  env: AppImportMetaEnv;
}

const API_BASE_URL = ((import.meta as AppImportMeta).env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => (API_BASE_URL ? `${API_BASE_URL}${path}` : path);

export default function App() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'pending' | 'saving' | 'saved' | 'error'>('idle');
  const [view, setView] = useState<'calendar' | 'table'>('calendar');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [logs, setLogs] = useState<Record<string, DailyLog>>({});
  const [currentLog, setCurrentLog] = useState<DailyLog>(defaultLog);
  const [countDrafts, setCountDrafts] = useState({ whiteheads: '0', cystic_acne: '0', water: '0', acne_state: '0' });
  const [isLoading, setIsLoading] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const lastSavedRef = useRef<string>('');
  const forceSaveRef = useRef(false);
  const logsRef = useRef<Record<string, DailyLog>>({});
  const selectedDateRef = useRef<Date>(new Date());
  const saveSequenceRef = useRef(0);
  const latestSaveTokenByDateRef = useRef<Record<string, number>>({});

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    logsRef.current = logs;
  }, [logs]);

  useEffect(() => {
    selectedDateRef.current = selectedDate;
  }, [selectedDate]);

  useEffect(() => {
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existingLog = logsRef.current[dateStr];

    if (existingLog) {
      const logForDate = normalizeLog(existingLog);
      setCurrentLog(logForDate);
      setCountDrafts({
        whiteheads: String(logForDate.whiteheads ?? 0),
        cystic_acne: String(logForDate.cystic_acne ?? 0),
        water: String(logForDate.water ?? 0),
        acne_state: String(logForDate.acne_state ?? 0),
      });
      lastSavedRef.current = JSON.stringify(logForDate);
    } else {
      const emptyLog = { ...defaultLog, date: dateStr };
      setCurrentLog(emptyLog);
      setCountDrafts({ whiteheads: '0', cystic_acne: '0', water: '0', acne_state: '0' });
      lastSavedRef.current = JSON.stringify(emptyLog);
    }
    forceSaveRef.current = false;
    setIsDirty(false);
    setSaveState('idle');
  }, [selectedDate]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const parseBool = (value: unknown): boolean => {
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value > 0;
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (['true', 'yes', 'on'].includes(normalized)) return true;
      const numeric = Number(normalized);
      if (Number.isFinite(numeric)) return numeric > 0;
    }
    return false;
  };

  const normalizeLog = (log: any): DailyLog => ({
    ...log,
    water: typeof log.water === 'number' ? log.water : parseInt(log.water || '0', 10) || 0,
    stress: typeof log.stress === 'number' ? log.stress : parseInt(log.stress || '0', 10) || 0,
    whiteheads: typeof log.whiteheads === 'number' ? log.whiteheads : parseInt(log.whiteheads || '0', 10) || 0,
    cystic_acne: typeof log.cystic_acne === 'number' ? log.cystic_acne : parseInt(log.cystic_acne || '0', 10) || 0,
    acne_state: typeof log.acne_state === 'number' ? log.acne_state : parseInt(log.acne_state || '0', 10) || 0,
    exercise: parseBool(log.exercise),
    sunlight: parseBool(log.sunlight),
    pleasure: parseBool(log.pleasure),
  });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(apiUrl('/api/logs'));
      if (res.ok) {
        const data = await res.json();
        const logsMap: Record<string, DailyLog> = {};
        data.forEach((log: DailyLog) => {
          const normalized = normalizeLog(log);
          logsMap[normalized.date] = normalized;
        });
        setLogs(logsMap);

        if (!isDirty) {
          const activeDate = format(selectedDateRef.current, 'yyyy-MM-dd');
          const activeLog = logsMap[activeDate];
          if (activeLog) {
            const logForDate = normalizeLog(activeLog);
            setCurrentLog(logForDate);
            setCountDrafts({
              whiteheads: String(logForDate.whiteheads ?? 0),
              cystic_acne: String(logForDate.cystic_acne ?? 0),
              water: String(logForDate.water ?? 0),
              acne_state: String(logForDate.acne_state ?? 0),
            });
            lastSavedRef.current = JSON.stringify(logForDate);
          } else {
            const emptyLog = { ...defaultLog, date: activeDate };
            setCurrentLog(emptyLog);
            setCountDrafts({ whiteheads: '0', cystic_acne: '0', water: '0', acne_state: '0' });
            lastSavedRef.current = JSON.stringify(emptyLog);
          }
          forceSaveRef.current = false;
          setIsDirty(false);
          setSaveState('idle');
        }
      }
    } catch (error) {
      console.error('Failed to fetch logs', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveLog = async (logToSave: DailyLog) => {
    const savingDate = logToSave.date;
    const saveToken = ++saveSequenceRef.current;
    latestSaveTokenByDateRef.current[savingDate] = saveToken;
    const currentDateAtStart = format(selectedDateRef.current, 'yyyy-MM-dd');
    const isActiveAtStart = savingDate === currentDateAtStart;
    if (isActiveAtStart) {
      setSaveState('saving');
    }

    try {
      const res = await fetch(apiUrl('/api/logs'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logToSave),
      });

      if (!res.ok) {
        throw new Error('Save failed');
      }

      const payload = await res.json();
      if (latestSaveTokenByDateRef.current[savingDate] !== saveToken) {
        return;
      }

      const savedLog = payload?.log ? normalizeLog(payload.log) : normalizeLog(logToSave);
      const localSnapshot = normalizeLog(logToSave);
      setLogs(prev => ({ ...prev, [savedLog.date]: savedLog }));

      const currentDateAtFinish = format(selectedDateRef.current, 'yyyy-MM-dd');
      const isActiveAtFinish = savingDate === currentDateAtFinish;
      if (!isActiveAtFinish) {
        return;
      }

      setCurrentLog(localSnapshot);
      setCountDrafts({
        whiteheads: String(localSnapshot.whiteheads ?? 0),
        cystic_acne: String(localSnapshot.cystic_acne ?? 0),
        water: String(localSnapshot.water ?? 0),
        acne_state: String(localSnapshot.acne_state ?? 0),
      });
      lastSavedRef.current = JSON.stringify(localSnapshot);
      forceSaveRef.current = false;
      setIsDirty(false);
      setSaveState('saved');
      setToast({ message: 'Saved successfully', type: 'success' });
    } catch (error) {
      console.error('Failed to save log', error);
      if (latestSaveTokenByDateRef.current[savingDate] !== saveToken) {
        return;
      }

      const currentDateAtError = format(selectedDateRef.current, 'yyyy-MM-dd');
      if (savingDate !== currentDateAtError) {
        return;
      }
      setSaveState('error');
      setToast({ message: 'Failed to save', type: 'error' });
    }
  };

  useEffect(() => {
    if (!isDirty) return;

    const currentSnapshot = JSON.stringify(currentLog);
    if (currentSnapshot === lastSavedRef.current && !forceSaveRef.current) {
      setIsDirty(false);
      setSaveState('idle');
      return;
    }

    setSaveState('pending');
    const timer = setTimeout(() => {
      void saveLog(currentLog);
    }, 1800);

    return () => clearTimeout(timer);
  }, [currentLog, isDirty]);

  const handleExport = () => {
    window.location.href = apiUrl('/api/export');
  };

  const handleInputChange = (field: keyof DailyLog, value: string | number | boolean) => {
    setCurrentLog(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const digitsOnly = (value: string): string => {
    return value.replace(/\D/g, '');
  };

  const parseWholeNumber = (value: string): number => {
    const sanitized = digitsOnly(value);
    if (sanitized === '') return 0;
    return parseInt(sanitized, 10);
  };

  const withDraftCountsApplied = (log: DailyLog): DailyLog => ({
    ...log,
    whiteheads: parseWholeNumber(countDrafts.whiteheads),
    cystic_acne: parseWholeNumber(countDrafts.cystic_acne),
    water: parseWholeNumber(countDrafts.water),
    acne_state: parseWholeNumber(countDrafts.acne_state),
  });

  useEffect(() => {
    const nextWhiteheads = parseWholeNumber(countDrafts.whiteheads);
    const nextCystic = parseWholeNumber(countDrafts.cystic_acne);
    const nextWater = parseWholeNumber(countDrafts.water);

    setCurrentLog(prev => {
      const prevWater = prev.water ?? 0;
      const hasChanged =
        prev.whiteheads !== nextWhiteheads ||
        prev.cystic_acne !== nextCystic ||
        prevWater !== nextWater ||
        prev.acne_state !== parseWholeNumber(countDrafts.acne_state);

      const nextAcneState = parseWholeNumber(countDrafts.acne_state);

      if (!hasChanged) return prev;

      setIsDirty(true);
      return {
        ...prev,
        whiteheads: nextWhiteheads,
        cystic_acne: nextCystic,
        water: nextWater,
        acne_state: nextAcneState,
      };
    });
  }, [countDrafts.whiteheads, countDrafts.cystic_acne, countDrafts.water, countDrafts.acne_state]);

  const handleCountDraftChange = (field: 'whiteheads' | 'cystic_acne' | 'water' | 'acne_state', rawValue: string) => {
    const sanitized = digitsOnly(rawValue);
    const normalizedDraft = sanitized === '' ? '0' : String(parseInt(sanitized, 10));
    const currentDraft = countDrafts[field];
    if (normalizedDraft !== currentDraft) {
      const currentNumericValue = field === 'water' ? (currentLog.water ?? 0) : currentLog[field];
      const parsedValue = parseWholeNumber(normalizedDraft);
      if (parsedValue === currentNumericValue) {
        forceSaveRef.current = true;
        setIsDirty(true);
      }
    }
    setCountDrafts(prev => ({ ...prev, [field]: normalizedDraft }));
  };

  const navigateToDate = (nextDate: Date) => {
    const logForNavigation = withDraftCountsApplied(currentLog);
    const navigationSnapshot = JSON.stringify(logForNavigation);
    const shouldSaveBeforeNavigation =
      navigationSnapshot !== lastSavedRef.current || forceSaveRef.current || isDirty;

    if (shouldSaveBeforeNavigation) {
      void saveLog(logForNavigation);
    }

    setSelectedDate(nextDate);
  };

  const switchView = (nextView: 'calendar' | 'table') => {
    if (nextView === view) return;

    const logForSwitch = withDraftCountsApplied(currentLog);
    const switchSnapshot = JSON.stringify(logForSwitch);
    const shouldSaveBeforeSwitch =
      switchSnapshot !== lastSavedRef.current || forceSaveRef.current || isDirty;

    if (shouldSaveBeforeSwitch) {
      void saveLog(logForSwitch);
    }

    setView(nextView);
  };

  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const nextMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-stone-900 rounded-lg flex items-center justify-center text-white font-bold">
              B
            </div>
            <h1 className="font-semibold text-lg tracking-tight hidden sm:block">Break Out</h1>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void fetchLogs()}
              disabled={isLoading}
              aria-label="Refresh logs"
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => switchView('calendar')}
              className={cn(view === 'calendar' && "bg-stone-100")}
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Calendar</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => switchView('table')}
              className={cn(view === 'table' && "bg-stone-100")}
            >
              <List className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Table</span>
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport} className="hidden sm:flex">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* Left Column: Navigation/View */}
          <div className="lg:col-span-7 space-y-6">
            {view === 'calendar' ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                  <CardTitle className="text-lg font-medium">
                    {format(currentMonth, 'MMMM yyyy')}
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={prevMonth}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={nextMonth}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-1 text-center mb-2">
                    {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                      <div key={day} className="text-xs font-medium text-stone-500 py-1">
                        {day}
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {Array.from({ length: startOfMonth(currentMonth).getDay() }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}
                    {daysInMonth.map(day => {
                      const dateStr = format(day, 'yyyy-MM-dd');
                      const hasData = !!logs[dateStr];
                      const isSelected = isSameDay(day, selectedDate);
                      const isTodayDate = isToday(day);

                      return (
                        <button
                          key={dateStr}
                          onClick={() => navigateToDate(day)}
                          className={cn(
                            "aspect-square rounded-md flex flex-col items-center justify-center relative transition-all hover:bg-stone-100",
                            hasData && "bg-green-100 text-green-900 hover:bg-green-200",
                            isSelected && "ring-2 ring-stone-900 z-10",
                            isTodayDate && !isSelected && "bg-stone-50 font-semibold text-stone-900 border border-stone-200"
                          )}
                        >
                          <span className={cn("text-sm", isTodayDate && "font-bold")}>
                            {format(day, 'd')}
                          </span>
                          {hasData && (
                            <div className="w-1.5 h-1.5 rounded-full mt-1 bg-green-500" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="bg-stone-100 text-stone-600 font-medium border-b border-stone-200">
                      <tr>
                        <th className="px-4 py-3 whitespace-nowrap">Date</th>
                        <th className="px-4 py-3 whitespace-nowrap">Acne (W/C)</th>
                        <th className="px-4 py-3 whitespace-nowrap">Food</th>
                        <th className="px-4 py-3 whitespace-nowrap">Lifestyle</th>
                        <th className="px-4 py-3 whitespace-nowrap">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(Object.values(logs) as DailyLog[])
                        .sort((a, b) => b.date.localeCompare(a.date))
                        .map(log => (
                          <tr key={log.date} className="hover:bg-stone-50">
                            <td className="px-4 py-3 font-medium whitespace-nowrap">{log.date}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-stone-100 text-stone-800">
                                {log.whiteheads}W / {log.cystic_acne}C
                              </span>
                            </td>
                            <td className="px-4 py-3 max-w-[200px] truncate text-stone-500">
                              {[log.breakfast, log.lunch, log.dinner].filter(Boolean).join(', ')}
                            </td>
                            <td className="px-4 py-3 max-w-[200px] truncate text-stone-500">
                              {[
                                log.sleep ? `Sleep: ${log.sleep}` : '',
                                `Stress: ${log.stress ?? 0}/10`,
                                log.exercise ? 'Exercise: Yes' : '',
                                log.sunlight ? 'Sunlight: Yes' : '',
                                log.pleasure ? 'Pleasure: Yes' : '',
                              ].filter(Boolean).join(', ')}
                            </td>
                            <td className="px-4 py-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  navigateToDate(parseISO(log.date));
                                  setView('calendar');
                                }}
                              >
                                Edit
                              </Button>
                            </td>
                          </tr>
                        ))}
                      {Object.keys(logs).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                            No logs yet. Start tracking!
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}

            {/* Quick Stats / Trends could go here */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Avg Sleep</span>
                  <span className="text-2xl font-semibold mt-1">
                    {Object.values(logs).length > 0
                      ? ((Object.values(logs) as DailyLog[]).reduce((acc, log) => acc + (parseFloat(log.sleep || '0') || 0), 0) / (Object.values(logs) as DailyLog[]).filter(l => parseFloat(l.sleep || '0') > 0).length || 0).toFixed(1)
                      : '-'}
                    <span className="text-sm font-normal text-stone-400 ml-1">hrs</span>
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Avg Acne State</span>
                  <span className="text-2xl font-semibold mt-1">
                    {Object.values(logs).length > 0
                      ? ((Object.values(logs) as DailyLog[]).reduce((acc, log) => acc + (log.acne_state ?? 0), 0) / Object.values(logs).length).toFixed(1)
                      : '-'}
                  </span>
                </CardContent>
              </Card>
              <Card className="bg-white">
                <CardContent className="p-4 flex flex-col items-center justify-center text-center">
                  <span className="text-xs font-medium text-stone-500 uppercase tracking-wider">Logged Days</span>
                  <span className="text-2xl font-semibold mt-1">
                    {Object.keys(logs).length}
                  </span>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Editor Form */}
          <div className="lg:col-span-5">
            <motion.div
              key={selectedDate.toISOString()}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="sticky top-24 border-stone-300 shadow-md">
                <CardHeader className="bg-stone-50 border-b border-stone-100 pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle>
                      {format(selectedDate, 'EEEE, MMMM do')}
                    </CardTitle>
                    <div className="flex items-end flex-col gap-1">
                      {isToday(selectedDate) && (
                        <span className="text-xs font-medium bg-stone-900 text-white px-2 py-1 rounded">Today</span>
                      )}
                      <span className="text-xs text-stone-500">
                        {saveState === 'pending' && 'Autosaving in a moment...'}
                        {saveState === 'saving' && 'Saving...'}
                        {saveState === 'saved' && 'Saved'}
                        {saveState === 'error' && 'Save failed'}
                        {(saveState === 'idle' || (!isDirty && saveState !== 'saved')) && 'Autosave is on'}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <form onSubmit={(e) => e.preventDefault()} className="divide-y divide-stone-100">

                    {/* Acne Section - High Priority */}
                    <div className="p-5 bg-red-50/30">
                      <h4 className="text-xs font-bold text-red-900 uppercase tracking-wider mb-3">Acne Tracking (Morning)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-stone-700">Whiteheads</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={countDrafts.whiteheads}
                            onChange={(e) => handleCountDraftChange('whiteheads', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-stone-700">Cystic / Big</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={countDrafts.cystic_acne}
                            onChange={(e) => handleCountDraftChange('cystic_acne', e.target.value)}
                            className="bg-white border-red-200 focus-visible:ring-red-500"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-stone-700">Sleep (hrs)</label>
                          <Input
                            placeholder="Sleep (hrs)"
                            value={currentLog.sleep || ''}
                            onChange={(e) => handleInputChange('sleep', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-sm font-medium text-stone-700">Acne State</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={countDrafts.acne_state}
                            onChange={(e) => handleCountDraftChange('acne_state', e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Food Section */}
                    <div className="p-5">
                      <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Food & Drink</h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          <Input
                            placeholder="Breakfast"
                            value={currentLog.breakfast || ''}
                            onChange={(e) => handleInputChange('breakfast', e.target.value)}
                          />
                          <Input
                            placeholder="Lunch"
                            value={currentLog.lunch || ''}
                            onChange={(e) => handleInputChange('lunch', e.target.value)}
                          />
                          <Input
                            placeholder="Dinner"
                            value={currentLog.dinner || ''}
                            onChange={(e) => handleInputChange('dinner', e.target.value)}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3 pt-2">
                          <Input
                            placeholder="Snacks"
                            value={currentLog.snacks || ''}
                            onChange={(e) => handleInputChange('snacks', e.target.value)}
                          />
                          <Input
                            placeholder="Dairy Intake"
                            value={currentLog.dairy || ''}
                            onChange={(e) => handleInputChange('dairy', e.target.value)}
                          />
                        </div>
                        <div className="pt-2">
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="Water Intake (cups)"
                            value={countDrafts.water}
                            onChange={(e) => handleCountDraftChange('water', e.target.value)}
                          />
                          <p className="text-xs text-stone-500 mt-1">Measured in cups</p>
                        </div>
                      </div>
                    </div>

                    {/* Lifestyle Section */}
                    <div className="p-5">
                      <h4 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">Lifestyle</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-1 flex flex-col justify-center">
                          <label className="text-xs font-medium text-stone-500 mb-1">Stress: {currentLog.stress ?? 0}/10</label>
                          <input
                            type="range"
                            min={0}
                            max={10}
                            step={1}
                            value={currentLog.stress ?? 0}
                            onChange={(e) => handleInputChange('stress', parseInt(e.target.value, 10) || 0)}
                          />
                        </div>
                        <div className="col-span-1" />
                        <label className="col-span-2 flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={!!currentLog.exercise}
                            onChange={(e) => handleInputChange('exercise', e.target.checked)}
                          />
                          Exercise
                        </label>
                        <label className="col-span-2 flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={!!currentLog.sunlight}
                            onChange={(e) => handleInputChange('sunlight', e.target.checked)}
                          />
                          Sunlight
                        </label>
                        <label className="col-span-2 flex items-center gap-2 text-sm text-stone-700">
                          <input
                            type="checkbox"
                            checked={!!currentLog.pleasure}
                            onChange={(e) => handleInputChange('pleasure', e.target.checked)}
                          />
                          Meditation
                        </label>
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="p-5">
                      <Textarea
                        placeholder="Additional notes..."
                        className="resize-none"
                        value={currentLog.notes || ''}
                        onChange={(e) => handleInputChange('notes', e.target.value)}
                      />
                    </div>
                  </form>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </main>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50">
          <div
            className={cn(
              'rounded-md px-4 py-2 text-sm shadow-lg border',
              toast.type === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : 'bg-red-50 text-red-800 border-red-200'
            )}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
