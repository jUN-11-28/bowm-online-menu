'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { generateSpeech, generateBroadcastText, formatNumberForSpeech } from '@/utils/tts';
import { supabase } from '@/utils/supabase/client';
import { BroadcastSchedule, DayOfWeek, BroadcastType, ClosingType as ClosingTypeEnum } from '@/types/menu';

type BroadcastCategory = 'vibration' | 'vehicle' | 'smoking' | 'closing' | 'custom' | null;
type ClosingType = 'floor' | 'store' | null;

interface Playlist {
  id: string;
  title: string;
  description: string | null;
  audio_url: string;
  artist: string | null;
  artwork_url: string | null;
  version_tag: string | null;
  is_active: boolean;
}

export default function BroadcastPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<BroadcastCategory>(null);
  const [vibrationNumber, setVibrationNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [customText, setCustomText] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [closingType, setClosingType] = useState<ClosingType>(null);
  const [status, setStatus] = useState('시스템 준비 중...');
  const inputSectionRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // 배경음악 관련 상태
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [showPlaylistModal, setShowPlaylistModal] = useState(false);
  const bgMusicRef = useRef<HTMLAudioElement>(null);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const [wakeLockEnabled, setWakeLockEnabled] = useState(false);
  const [wakeLockSupported, setWakeLockSupported] = useState(false);

  // 예약 관련 상태
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [schedules, setSchedules] = useState<BroadcastSchedule[]>([]);
  const [lastExecutedScheduleId, setLastExecutedScheduleId] = useState<string | null>(null);
  const [scheduleForm, setScheduleForm] = useState({
    broadcastType: 'vibration' as BroadcastType,
    selectedDays: new Set<DayOfWeek>(['MON']),
    hour: 9,
    minute: 0,
    vibrationNumber: '',
    vehicleNumber: '',
    customText: '',
    closingType: 'store' as ClosingTypeEnum,
  });

  const DAYS = [
    { key: 'MON', label: '월' },
    { key: 'TUE', label: '화' },
    { key: 'WED', label: '수' },
    { key: 'THU', label: '목' },
    { key: 'FRI', label: '금' },
    { key: 'SAT', label: '토' },
    { key: 'SUN', label: '일' },
  ] as const;

  // 인증 상태 확인
  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login?redirect=/broadcast');
      } else {
        setIsAuthenticated(true);
      }
    };

    checkAuth();

    // 인증 상태 변경 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        router.push('/login?redirect=/broadcast');
      } else {
        setIsAuthenticated(true);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [router]);

  // Wake Lock 지원 확인
  useEffect(() => {
    setWakeLockSupported('wakeLock' in navigator);
  }, []);

  // 예약 불러오기 및 실시간 감시
  useEffect(() => {
    const fetchSchedules = async () => {
      const { data, error } = await supabase
        .from('broadcast_schedules')
        .select('*')
        .eq('is_active', true);
      
      if (error) {
        console.error('예약 로드 실패:', error);
      } else if (data) {
        setSchedules(data);
      }
    };
    
    fetchSchedules();

    // Realtime 구독 설정
    const channel = supabase
      .channel('broadcast_schedules_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'broadcast_schedules',
        },
        (payload) => {
          console.log('예약 변경 감지:', payload);
          fetchSchedules(); // 변경 시 다시 로드
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // 시간이 바뀔 때 lastExecutedScheduleId 초기화
  useEffect(() => {
    const checkTimeChange = () => {
      const now = new Date();
      const currentMinute = now.getMinutes();
      
      // 시간이 바뀔 때 (분이 0~1분 범위일 때만) 초기화하여 다음 시간 예약 준비
      if (currentMinute <= 1) {
        setLastExecutedScheduleId(null);
      }
    };

    // 매분 시간 체크
    const interval = setInterval(checkTimeChange, 60000); // 1분마다
    
    // 초기 체크
    checkTimeChange();
    
    return () => clearInterval(interval);
  }, []);

  // Cleanup: 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => undefined);
        wakeLockRef.current = null;
      }
    };
  }, []);

  // 예약 시간 체크 및 실행
  useEffect(() => {
    const checkSchedules = () => {
      const now = new Date();
      const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()] as DayOfWeek;
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();

      schedules.forEach((schedule) => {
        if (
          schedule.days_of_week.includes(currentDay) &&
          schedule.hour === currentHour &&
          schedule.minute === currentMinute
        ) {
          handleScheduledBroadcast(schedule);
        }
      });
    };

    const interval = setInterval(checkSchedules, 30000); // 30초마다 체크
    return () => clearInterval(interval);
  }, [schedules]);

  // 예약된 방송 실행
  const handleScheduledBroadcast = (schedule: BroadcastSchedule) => {
    const { broadcast_type, vibration_number, vehicle_number, custom_text, closing_type } = schedule;

    if (broadcast_type === 'vibration' && vibration_number) {
      setVibrationNumber(vibration_number);
      const formattedNumber = formatNumberForSpeech(vibration_number);
      const content = `진동벨 ${formattedNumber}번, 진동벨 ${formattedNumber}번 고객님 주문하신 음료 나왔습니다.`;
      const fullText = generateBroadcastText(content);
      handlePlayBroadcast(fullText);
    } else if (broadcast_type === 'vehicle' && vehicle_number) {
      setVehicleNumber(vehicle_number);
      const formattedNumber = formatNumberForSpeech(vehicle_number);
      const content = `차량번호 ${formattedNumber}번, 차량번호 ${formattedNumber}번 차주님 이동 주차 부탁드립니다.`;
      const fullText = generateBroadcastText(content);
      handlePlayBroadcast(fullText);
    } else if (broadcast_type === 'smoking') {
      handlePlayAudioFile('/audio/smoking.mp3');
    } else if (broadcast_type === 'closing' && closing_type) {
      const filePath = closing_type === 'floor' ? '/audio/closing-floor.mp3' : '/audio/closing-store.mp3';
      handlePlayAudioFile(filePath);
    } else if (broadcast_type === 'custom' && custom_text) {
      setCustomText(custom_text);
      const fullText = generateBroadcastText(custom_text);
      handlePlayBroadcast(fullText);
    }
  };

  // 예약 추가
  const handleAddSchedule = async () => {
    if (
      scheduleForm.broadcastType === 'vibration' && !scheduleForm.vibrationNumber.trim()
    ) {
      alert('진동벨 번호를 입력해주세요.');
      return;
    }

    if (
      scheduleForm.broadcastType === 'vehicle' && !scheduleForm.vehicleNumber.trim()
    ) {
      alert('차량번호를 입력해주세요.');
      return;
    }

    if (
      scheduleForm.broadcastType === 'custom' && !scheduleForm.customText.trim()
    ) {
      alert('내용을 입력해주세요.');
      return;
    }

    const newSchedule: any = {
      broadcast_type: scheduleForm.broadcastType,
      days_of_week: Array.from(scheduleForm.selectedDays),
      hour: scheduleForm.hour,
      minute: scheduleForm.minute,
      is_active: true,
    };

    if (scheduleForm.broadcastType === 'vibration') {
      newSchedule.vibration_number = scheduleForm.vibrationNumber;
    } else if (scheduleForm.broadcastType === 'vehicle') {
      newSchedule.vehicle_number = scheduleForm.vehicleNumber;
    } else if (scheduleForm.broadcastType === 'custom') {
      newSchedule.custom_text = scheduleForm.customText;
    } else if (scheduleForm.broadcastType === 'closing') {
      newSchedule.closing_type = scheduleForm.closingType;
    }

    const { data, error } = await supabase
      .from('broadcast_schedules')
      .insert([newSchedule])
      .select();

    if (error) {
      console.error('예약 추가 실패:', error);
      alert('예약 추가 실패: ' + error.message);
    } else if (data) {
      setSchedules((prev) => {
        if (prev.some((s) => s.id === data[0].id)) return prev;
        return [...prev, data[0]];
      });
      resetScheduleForm();
      setShowScheduleModal(false);
      alert('예약이 추가되었습니다.');
    }
  };

  // 예약 삭제
  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('이 예약을 삭제하시겠습니까?')) return;

    // 즉시 UI에서 제거
    setSchedules((prev) => prev.filter((s) => s.id !== id));

    // 데이터베이스에서 삭제
    const { error } = await supabase
      .from('broadcast_schedules')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('예약 삭제 실패:', error);
      // 실패 시 다시 로드
      const { data } = await supabase
        .from('broadcast_schedules')
        .select('*')
        .eq('is_active', true);
      if (data) setSchedules(data);
    }
  };

  // 예약 폼 초기화
  const resetScheduleForm = () => {
    const now = new Date();
    const currentDay = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()] as DayOfWeek;
    const currentHour = now.getHours();
    
    setScheduleForm({
      broadcastType: 'vibration' as BroadcastType,
      selectedDays: new Set<DayOfWeek>([currentDay]),
      hour: currentHour,
      minute: 0,
      vibrationNumber: '',
      vehicleNumber: '',
      customText: '',
      closingType: 'store' as ClosingTypeEnum,
    });
  };

  const toggleDay = (day: DayOfWeek) => {
    const newDays = new Set(scheduleForm.selectedDays);
    if (newDays.has(day)) {
      newDays.delete(day);
    } else {
      newDays.add(day);
    }
    setScheduleForm({ ...scheduleForm, selectedDays: newDays });
  };


  // 플레이리스트 불러오기
  useEffect(() => {
    const fetchPlaylists = async () => {
      const { data, error } = await supabase
        .from('playlists')
        .select('*')
        .eq('is_active', true);
      
      if (error) {
        console.error('플레이리스트 로드 실패:', error);
      } else if (data) {
        setPlaylists(data);
      }
    };
    
    fetchPlaylists();
  }, []);

  // 배경음악 재생/정지
  const toggleMusic = () => {
    if (!bgMusicRef.current) return;
    
    if (isMusicPlaying) {
      bgMusicRef.current.pause();
      setIsMusicPlaying(false);
    } else {
      const playPromise = bgMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsMusicPlaying(true);
          })
          .catch((error) => {
            console.error('[배경음악] 재생 실패:', error);
          });
      }
    }
  };

  // 플레이리스트 선택
  const selectPlaylist = (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setShowPlaylistModal(false);
    
    if (bgMusicRef.current) {
      bgMusicRef.current.src = playlist.audio_url;
      bgMusicRef.current.loop = true;
      
      const playPromise = bgMusicRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsMusicPlaying(true);
          })
          .catch((error) => {
            console.error('[배경음악] 재생 실패:', error);
            setIsMusicPlaying(false);
          });
      }
    }
  };

  const toggleWakeLock = async () => {
    if (!wakeLockSupported) return;

    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setWakeLockEnabled(false);
      return;
    }

    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen');
      setWakeLockEnabled(true);
      wakeLockRef.current.addEventListener('release', () => {
        setWakeLockEnabled(false);
        wakeLockRef.current = null;
      });
    } catch (error) {
      console.error('Wake Lock 요청 실패:', error);
      setWakeLockEnabled(false);
    }
  };

  const handleCategorySelect = (category: BroadcastCategory) => {
    setSelectedCategory(category);
    setClosingType(null);
    setTimeout(() => {
      inputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  };

  const handlePlayAudioFile = async (filePath: string) => {
    setIsPlaying(true);
    setStatus('음성 재생 중...');
    
    // 배경음악 일시 정지
    const wasMusicPlaying = isMusicPlaying;
    if (bgMusicRef.current && wasMusicPlaying) {
      bgMusicRef.current.pause();
    }
    
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio();
      }
      audioRef.current.src = filePath;
      
      audioRef.current.onended = () => {
        setIsPlaying(false);
        setStatus('방송 완료');
        // 배경음악 재개
        if (bgMusicRef.current && wasMusicPlaying) {
          bgMusicRef.current.play().catch(console.error);
        }
      };
      
      audioRef.current.onerror = () => {
        console.error('오디오 로드 실패:', audioRef.current?.error);
        setStatus('오류: 파일을 재생할 수 없습니다');
        setIsPlaying(false);
        // 배경음악 재개
        if (bgMusicRef.current && wasMusicPlaying) {
          bgMusicRef.current.play().catch(console.error);
        }
      };
      
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise.catch((error) => {
          console.error('오디오 재생 오류:', error);
          let errorMsg = '재생에 실패했습니다';
          if (error.name === 'NotAllowedError') {
            errorMsg = '브라우저 정책으로 인해 자동 재생이 차단되었습니다.';
          } else if (error.name === 'NotSupportedError') {
            errorMsg = '지원하지 않는 오디오 형식입니다.';
          }
          setStatus(`오류: ${errorMsg}`);
          setIsPlaying(false);
          // 배경음악 재개
          if (bgMusicRef.current && wasMusicPlaying) {
            bgMusicRef.current.play().catch(console.error);
          }
        });
      }
    } catch (error) {
      console.error('재생 중 오류:', error);
      setStatus('오류: 재생할 수 없습니다');
      setIsPlaying(false);
      // 배경음악 재개
      if (bgMusicRef.current && wasMusicPlaying) {
        bgMusicRef.current.play().catch(console.error);
      }
    }
  };

  const handlePlayBroadcast = async (text: string) => {
    setIsPlaying(true);
    setStatus('음성 생성 중...');
    
    // 배경음악 상태를 저장 (TTS 완료 후 멈출 예정)
    const wasMusicPlaying = isMusicPlaying;
    
    try {
      await generateSpeech(text, {
        onPlayStart: () => {
          setStatus('음성 재생 중...');
          // TTS 재생 시작될 때 배경음악 일시 정지
          if (bgMusicRef.current && wasMusicPlaying) {
            bgMusicRef.current.pause();
          }
        },
        onPlayEnd: () => {
          setStatus('방송 완료');
          setIsPlaying(false);
          // 배경음악 재개
          if (bgMusicRef.current && wasMusicPlaying) {
            bgMusicRef.current.play().catch(console.error);
          }
        },
        onError: (error) => {
          console.error('음성 재생 오류:', error);
          setStatus(`오류: ${error.message}`);
          setIsPlaying(false);
          // 배경음악 재개
          if (bgMusicRef.current && wasMusicPlaying) {
            bgMusicRef.current.play().catch(console.error);
          }
        }
      });
    } catch (error) {
      console.error('재생 중 오류:', error);
      setStatus('오류: 재생할 수 없습니다');
      setIsPlaying(false);
      // 배경음악 재개
      if (bgMusicRef.current && wasMusicPlaying) {
        bgMusicRef.current.play().catch(console.error);
      }
    }
  };

  // 진동벨 방송
  const handleVibrationBroadcast = () => {
    if (!vibrationNumber.trim()) {
      alert('번호를 입력해주세요.');
      return;
    }
    const formattedNumber = formatNumberForSpeech(vibrationNumber);
    const content = `진동벨 ${formattedNumber}번, 진동벨 ${formattedNumber}번 고객님 주문하신 음료 나왔습니다.`;
    const fullText = generateBroadcastText(content);
    handlePlayBroadcast(fullText);
    setVibrationNumber('');
  };

  // 차량이동 방송
  const handleVehicleBroadcast = () => {
    if (!vehicleNumber.trim()) {
      alert('차량번호를 입력해주세요.');
      return;
    }
    const formattedNumber = formatNumberForSpeech(vehicleNumber);
    const content = `차량번호 ${formattedNumber}번, 차량번호 ${formattedNumber}번 차주님 이동 주차 부탁드립니다.`;
    const fullText = generateBroadcastText(content);
    handlePlayBroadcast(fullText);
    setVehicleNumber('');
  };

  // 금연 방송
  const handleSmokingBroadcast = () => {
    handlePlayAudioFile('/audio/smoking.mp3');
  };

  // 마감 방송
  const handleClosingBroadcast = (type: ClosingType) => {
    if (type === 'floor') {
      handlePlayAudioFile('/audio/closing-floor.mp3');
    } else if (type === 'store') {
      handlePlayAudioFile('/audio/closing-store.mp3');
    }
    setClosingType(null);
  };

  // 직접입력 방송
  const handleCustomBroadcast = () => {
    if (!customText.trim()) {
      alert('내용을 입력해주세요.');
      return;
    }
    const fullText = generateBroadcastText(customText);
    handlePlayBroadcast(fullText);
    setCustomText('');
  };

  // 인증 확인 중이면 로딩 표시
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg text-gray-600">인증 확인 중...</div>
      </div>
    );
  }

  // 인증되지 않았으면 아무것도 렌더링하지 않음 (리다이렉트 중)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-700 to-white font-sans pb-20">
      {/* 헤더 */}
      <header className="text-white pt-10 pb-16 px-6 text-center relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <h1 className="text-3xl font-black tracking-tight">보움 방송 시스템</h1>
          <div className="flex items-center justify-center space-x-3 mt-4">
            <div className={`w-2.5 h-2.5 rounded-full transition-all ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'}`} />
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-300">{status}</span>
          </div>
          {wakeLockSupported && (
            <div className="flex items-center justify-center pt-2">
              <button
                onClick={toggleWakeLock}
                className={`px-4 py-2 rounded-full text-xs font-bold transition-all shadow-md ${
                  wakeLockEnabled
                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                    : 'bg-white/90 text-slate-700 hover:bg-white'
                }`}
              >
                {wakeLockEnabled ? '화면 꺼짐 방지 켜짐' : '화면 꺼짐 방지 켜기'}
              </button>
            </div>
          )}
        </div>
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_120%,#3b82f633,transparent)]" />
      </header>

      <main className="max-w-4xl mx-auto px-4 space-y-6 relative z-20">

        {/* 배경음악 플레이어 */}
        <section className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 backdrop-blur-sm rounded-[2rem] p-6 shadow-xl border border-white/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4 flex-1">
              <button
                onClick={toggleMusic}
                disabled={!selectedPlaylist}
                className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-all shadow-lg ${
                  isMusicPlaying
                    ? 'bg-gradient-to-br from-purple-500 to-pink-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {isMusicPlaying ? '⏸' : '▶'}
              </button>
              
              <div className="flex-1 min-w-0">
                {selectedPlaylist ? (
                  <>
                    <h3 className="text-white font-bold text-lg truncate">{selectedPlaylist.title}</h3>
                    {selectedPlaylist.artist && (
                      <p className="text-white/70 text-sm truncate">{selectedPlaylist.artist}</p>
                    )}
                    <div className="flex items-center space-x-2 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse`} />
                      <span className="text-white/60 text-xs">
                        {isMusicPlaying ? '재생 중' : '일시정지'}
                      </span>
                    </div>
                  </>
                ) : (
                  <p className="text-white/80 text-sm">배경음악을 선택해주세요</p>
                )}
              </div>
            </div>
            
            <button
              onClick={() => setShowPlaylistModal(true)}
              className="px-6 py-3 bg-white/90 hover:bg-white text-purple-600 font-bold rounded-full transition-all shadow-md hover:shadow-lg text-sm"
            >
              🎵 음악 선택
            </button>
          </div>
        </section>

        {/* 방송 예약 섹션 */}
        <section className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 backdrop-blur-sm rounded-[2rem] p-6 shadow-xl border border-white/30">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-bold text-xl flex items-center space-x-2">
              <span>⏰</span>
              <span>방송 예약</span>
            </h2>
            <button
              onClick={() => {
                resetScheduleForm();
                setShowScheduleModal(true);
              }}
              className="px-6 py-2 bg-white/90 hover:bg-white text-blue-600 font-bold rounded-full transition-all shadow-md hover:shadow-lg text-sm"
            >
              + 예약 추가
            </button>
          </div>

          {schedules.length === 0 ? (
            <p className="text-white/70 text-center py-4">등록된 예약이 없습니다.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl p-3 flex items-center justify-between"
                >
                  <div className="text-white text-sm flex-1">
                    <div className="font-semibold">
                      {schedule.broadcast_type === 'vibration'
                        ? `진동벨: ${schedule.vibration_number}`
                        : schedule.broadcast_type === 'vehicle'
                        ? `차량이동: ${schedule.vehicle_number}`
                        : schedule.broadcast_type === 'smoking'
                        ? '금연 안내'
                        : schedule.broadcast_type === 'closing'
                        ? `마감 안내 (${schedule.closing_type === 'floor' ? '3층/지하' : '매장'})`
                        : `직접입력: ${schedule.custom_text}`}
                    </div>
                    <div className="text-xs text-white/60 mt-1">
                      {schedule.days_of_week.join(', ')} · {String(schedule.hour).padStart(2, '0')}:
                      {String(schedule.minute).padStart(2, '0')}
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteSchedule(schedule.id)}
                    className="px-3 py-1 bg-red-500/80 hover:bg-red-600 text-white rounded-lg text-xs font-semibold transition-all"
                  >
                    삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 플레이리스트 모달 */}
        {showPlaylistModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPlaylistModal(false)}>
            <div className="bg-white rounded-[2rem] p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">배경음악 선택</h2>
                <button
                  onClick={() => setShowPlaylistModal(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
                >
                  ✕
                </button>
              </div>
              
              <div className="space-y-3">
                {playlists.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <p className="text-4xl mb-4">🎵</p>
                    <p>사용 가능한 플레이리스트가 없습니다</p>
                  </div>
                ) : (
                  playlists.map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={() => selectPlaylist(playlist)}
                      className={`w-full p-4 rounded-2xl text-left transition-all border-2 ${
                        selectedPlaylist?.id === playlist.id
                          ? 'bg-purple-50 border-purple-500'
                          : 'bg-slate-50 border-transparent hover:bg-slate-100 hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center space-x-4">
                        {playlist.artwork_url ? (
                          <img
                            src={playlist.artwork_url}
                            alt={playlist.title}
                            className="w-16 h-16 rounded-xl object-cover"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-2xl">
                            🎵
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-slate-800 truncate">{playlist.title}</h3>
                          {playlist.artist && (
                            <p className="text-slate-600 text-sm truncate">{playlist.artist}</p>
                          )}
                          {playlist.description && (
                            <p className="text-slate-400 text-xs truncate mt-1">{playlist.description}</p>
                          )}
                        </div>
                        {selectedPlaylist?.id === playlist.id && (
                          <div className="text-purple-500 text-xl">✓</div>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* 방송 예약 모달 */}
        {showScheduleModal && (
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowScheduleModal(false)}
          >
            <div
              className="bg-white rounded-[2rem] p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-slate-800">방송 예약 추가</h2>
                <button
                  onClick={() => setShowScheduleModal(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-600 transition-all"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-6">
                {/* 방송 타입 선택 */}
                <div>
                  <label className="block font-bold text-slate-700 mb-3">방송 타입</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['vibration', 'vehicle', 'smoking', 'closing', 'custom'].map((type) => (
                      <button
                        key={type}
                        onClick={() =>
                          setScheduleForm({ ...scheduleForm, broadcastType: type as BroadcastType })
                        }
                        className={`py-2 px-3 rounded-lg font-semibold transition-all text-sm ${
                          scheduleForm.broadcastType === type
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {type === 'vibration'
                          ? '진동벨'
                          : type === 'vehicle'
                          ? '차량이동'
                          : type === 'smoking'
                          ? '금연'
                          : type === 'closing'
                          ? '마감'
                          : '직접입력'}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 요일 선택 */}
                <div>
                  <label className="block font-bold text-slate-700 mb-3">요일 선택</label>
                  <div className="grid grid-cols-7 gap-2">
                    {DAYS.map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => toggleDay(key as DayOfWeek)}
                        className={`py-2 px-2 rounded-lg font-semibold transition-all text-sm ${
                          scheduleForm.selectedDays.has(key as DayOfWeek)
                            ? 'bg-blue-500 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 시간 선택 */}
                <div>
                  <label className="block font-bold text-slate-700 mb-3">시간 설정</label>
                  <div className="flex gap-2 items-center justify-center">
                    {/* 시간 증감 */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, hour: (scheduleForm.hour + 1) % 24 })}
                        className="w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all"
                      >
                        ▲
                      </button>
                      <div className="w-16 h-16 border-2 border-slate-300 rounded-lg flex items-center justify-center font-bold text-2xl bg-slate-50">
                        {String(scheduleForm.hour).padStart(2, '0')}
                      </div>
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, hour: (scheduleForm.hour - 1 + 24) % 24 })}
                        className="w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all"
                      >
                        ▼
                      </button>
                    </div>

                    {/* 구분자 */}
                    <div className="text-3xl font-bold text-slate-400 pb-6">:</div>

                    {/* 분 증감 */}
                    <div className="flex flex-col items-center gap-1">
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, minute: (scheduleForm.minute + 1) % 60 })}
                        className="w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all"
                      >
                        ▲
                      </button>
                      <div className="w-16 h-16 border-2 border-slate-300 rounded-lg flex items-center justify-center font-bold text-2xl bg-slate-50">
                        {String(scheduleForm.minute).padStart(2, '0')}
                      </div>
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, minute: (scheduleForm.minute - 1 + 60) % 60 })}
                        className="w-10 h-10 rounded-lg bg-blue-500 hover:bg-blue-600 text-white font-bold transition-all"
                      >
                        ▼
                      </button>
                    </div>

                    {/* 빠른 설정 버튼 */}
                    <div className="ml-4 flex flex-col gap-2">
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, hour: 9, minute: 0 })}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                      >
                        9:00
                      </button>
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, hour: 12, minute: 0 })}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                      >
                        12:00
                      </button>
                      <button
                        onClick={() => setScheduleForm({ ...scheduleForm, hour: 18, minute: 0 })}
                        className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                      >
                        18:00
                      </button>
                    </div>
                  </div>
                </div>

                {/* 방송 타입별 추가 입력 */}
                {scheduleForm.broadcastType === 'vibration' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">진동벨 번호</label>
                    <input
                      type="text"
                      value={scheduleForm.vibrationNumber}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, vibrationNumber: e.target.value })
                      }
                      placeholder="예: 15"
                      className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none"
                    />
                  </div>
                )}

                {scheduleForm.broadcastType === 'vehicle' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">차량번호</label>
                    <input
                      type="text"
                      value={scheduleForm.vehicleNumber}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, vehicleNumber: e.target.value })
                      }
                      placeholder="예: 123가4567"
                      className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none"
                    />
                  </div>
                )}

                {scheduleForm.broadcastType === 'custom' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">내용</label>
                    <textarea
                      value={scheduleForm.customText}
                      onChange={(e) =>
                        setScheduleForm({ ...scheduleForm, customText: e.target.value })
                      }
                      placeholder="방송 내용을 입력하세요"
                      rows={4}
                      className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-blue-500 outline-none resize-none"
                    />
                  </div>
                )}

                {scheduleForm.broadcastType === 'closing' && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-2">마감 타입</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { value: 'floor' as const, label: '3층/지하 마감' },
                        { value: 'store' as const, label: '매장 마감' },
                      ].map(({ value, label }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setScheduleForm({ ...scheduleForm, closingType: value })
                          }
                          className={`py-2 px-3 rounded-lg font-semibold transition-all ${
                            scheduleForm.closingType === value
                              ? 'bg-blue-500 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 버튼 */}
                <div className="flex space-x-4 pt-4">
                  <button
                    onClick={handleAddSchedule}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all"
                  >
                    예약 추가
                  </button>
                  <button
                    onClick={() => setShowScheduleModal(false)}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-3 rounded-xl transition-all"
                  >
                    취소
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 배경음악 오디오 엘리먼트 */}
        <audio ref={bgMusicRef} />

        {/* 카테고리 선택 */}
        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <button
            onClick={() => handleCategorySelect('vibration')}
            className={`flex flex-col items-center justify-center p-4 rounded-[2rem] transition-all duration-300 border-2 ${
              selectedCategory === 'vibration'
                ? 'bg-white border-blue-600 shadow-xl scale-105'
                : 'bg-white/80 border-transparent hover:bg-white hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-2 transition-colors ${
              selectedCategory === 'vibration' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              <span className="text-3xl">📳</span>
            </div>
            <span className={`text-xs font-bold ${selectedCategory === 'vibration' ? 'text-blue-600' : 'text-slate-700'}`}>진동벨</span>
          </button>

          <button
            onClick={() => handleCategorySelect('vehicle')}
            className={`flex flex-col items-center justify-center p-4 rounded-[2rem] transition-all duration-300 border-2 ${
              selectedCategory === 'vehicle'
                ? 'bg-white border-blue-600 shadow-xl scale-105'
                : 'bg-white/80 border-transparent hover:bg-white hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-2 transition-colors ${
              selectedCategory === 'vehicle' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              <span className="text-3xl">🚗</span>
            </div>
            <span className={`text-xs font-bold ${selectedCategory === 'vehicle' ? 'text-blue-600' : 'text-slate-700'}`}>차량이동</span>
          </button>

          <button
            onClick={() => handleCategorySelect('smoking')}
            className={`flex flex-col items-center justify-center p-4 rounded-[2rem] transition-all duration-300 border-2 ${
              selectedCategory === 'smoking'
                ? 'bg-white border-blue-600 shadow-xl scale-105'
                : 'bg-white/80 border-transparent hover:bg-white hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-2 transition-colors ${
              selectedCategory === 'smoking' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              <span className="text-3xl">🚭</span>
            </div>
            <span className={`text-xs font-bold ${selectedCategory === 'smoking' ? 'text-blue-600' : 'text-slate-700'}`}>금연안내</span>
          </button>

          <button
            onClick={() => handleCategorySelect('closing')}
            className={`flex flex-col items-center justify-center p-4 rounded-[2rem] transition-all duration-300 border-2 ${
              selectedCategory === 'closing'
                ? 'bg-white border-blue-600 shadow-xl scale-105'
                : 'bg-white/80 border-transparent hover:bg-white hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-2 transition-colors ${
              selectedCategory === 'closing' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              <span className="text-3xl">🔔</span>
            </div>
            <span className={`text-xs font-bold ${selectedCategory === 'closing' ? 'text-blue-600' : 'text-slate-700'}`}>마감안내</span>
          </button>

          <button
            onClick={() => handleCategorySelect('custom')}
            className={`flex flex-col items-center justify-center p-4 rounded-[2rem] transition-all duration-300 border-2 col-span-2 md:col-span-1 ${
              selectedCategory === 'custom'
                ? 'bg-white border-blue-600 shadow-xl scale-105'
                : 'bg-white/80 border-transparent hover:bg-white hover:border-blue-400 hover:shadow-lg'
            }`}
          >
            <div className={`p-3 rounded-2xl mb-2 transition-colors ${
              selectedCategory === 'custom' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
            }`}>
              <span className="text-3xl">⌨️</span>
            </div>
            <span className={`text-xs font-bold ${selectedCategory === 'custom' ? 'text-blue-600' : 'text-slate-700'}`}>직접입력</span>
          </button>
        </section>

        {/* 입력 섹션 - 카테고리 선택 시 표시 */}
        {selectedCategory && (
          <section ref={inputSectionRef} className="bg-white rounded-[3rem] p-6 md:p-10 shadow-2xl border border-white/50 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="mb-8 text-center">
                <h3 className="text-2xl font-bold text-slate-800">
                  {selectedCategory === 'vibration' && '진동벨 방송'}
                  {selectedCategory === 'vehicle' && '차량이동 방송'}
                  {selectedCategory === 'smoking' && '금연 안내'}
                  {selectedCategory === 'closing' && '마감 안내'}
                  {selectedCategory === 'custom' && '직접입력'}
                </h3>
              </div>

              <div className="bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 flex flex-col items-center space-y-6">
                {/* 진동벨 */}
                {selectedCategory === 'vibration' && (
                  <div className="relative group w-full max-w-sm">
                    <div className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500">
                      <span className="text-2xl">#</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={vibrationNumber}
                      onChange={(e) => setVibrationNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleVibrationBroadcast()}
                      placeholder="번호"
                      className="w-full pl-20 pr-8 py-8 bg-white border-2 border-transparent focus:border-blue-500 rounded-[2rem] text-4xl font-black outline-none shadow-xl transition-all text-black"
                    />
                  </div>
                )}

                {/* 차량이동 */}
                {selectedCategory === 'vehicle' && (
                  <div className="relative group w-full max-w-sm">
                    <div className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500">
                      <span className="text-2xl">#</span>
                    </div>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={vehicleNumber}
                      onChange={(e) => setVehicleNumber(e.target.value.replace(/[^0-9]/g, ''))}
                      onKeyDown={(e) => e.key === 'Enter' && handleVehicleBroadcast()}
                      placeholder="차량번호"
                      className="w-full pl-20 pr-8 py-8 bg-white border-2 border-transparent focus:border-blue-500 rounded-[2rem] text-4xl font-black outline-none shadow-xl transition-all text-black"
                    />
                  </div>
                )}

                {/* 금연 */}
                {selectedCategory === 'smoking' && (
                  <div className="text-center py-6">
                    <div className="p-6 bg-white rounded-full shadow-md mb-4 inline-block">
                      <span className="text-5xl">🚭</span>
                    </div>
                    <p className="text-slate-600 font-medium">금연 안내 방송</p>
                    <p className="text-slate-400 text-sm mt-2">매장 내 금연 구역 안내</p>
                  </div>
                )}

                {/* 마감 */}
                {selectedCategory === 'closing' && closingType === null && (
                  <div className="w-full space-y-3">
                    <button
                      onClick={() => setClosingType('floor')}
                      className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-bold py-6 px-6 rounded-[2rem] transition-all duration-300 shadow-lg shadow-orange-200 text-lg"
                    >
                      3층과 지하 마감 안내
                    </button>
                    <button
                      onClick={() => setClosingType('store')}
                      className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold py-6 px-6 rounded-[2rem] transition-all duration-300 shadow-lg shadow-red-200 text-lg"
                    >
                      보움 매장 마감 안내
                    </button>
                  </div>
                )}

                {selectedCategory === 'closing' && closingType !== null && (
                  <div className="text-center py-4 w-full">
                    <div className="p-6 bg-white rounded-full shadow-md mb-4 inline-block">
                      <span className="text-5xl">🔔</span>
                    </div>
                    <h4 className="font-bold text-lg text-slate-800 mb-4">
                      {closingType === 'floor' ? '3층과 지하 마감' : '보움 매장 마감'}
                    </h4>
                    <p className="text-slate-600 text-sm leading-relaxed bg-white p-4 rounded-2xl max-h-64 overflow-y-auto">
                      {closingType === 'floor'
                        ? '잠시 후 오후 5시부터 3층과 지하 공간의 이용이 종료될 예정입니다. 보움에서의 시간을 계속 즐기실 고객님께서는 1층 또는 2층에 마련된 좌석을 이용해 주시기 바랍니다. 자리를 옮기실 때 소지품을 놓고 가시지 않도록 다시 한번 확인해 주시기 바랍니다.'
                        : '창밖으로 깊은 어둠이 찾아든 오후 5시 50분입니다. 10분 뒤인 오후 6시가 되면, 보움의 하루도 마무리를 하게 됩니다. 찬바람이 부는 바깥과 달리, 오늘 일렁이는 바다를 바라보며 머무셨던 이곳에서의 시간이 여러분의 하루 중 가장 따뜻하고 평온한 힐링의 순간이 되었기를 바랍니다. 이용 중이신 자리의 소지품을 다시 한번 확인해 주시고, 남으신 음료와 트레이는 반납대로 부탁드립니다. 어두운 밤길 조심히 귀가하시고, 오늘도 보움을 찾아주셔서 진심으로 감사합니다. 저희는 내일 더 좋은 모습으로 여러분을 기다리겠습니다.'}
                    </p>
                    <button
                      onClick={() => setClosingType(null)}
                      className="mt-4 px-6 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-full font-bold transition-all text-sm"
                    >
                      다른 마감 선택
                    </button>
                  </div>
                )}

                {/* 직접입력 */}
                {selectedCategory === 'custom' && (
                  <textarea
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="내용 입력..."
                    className="w-full h-40 p-8 bg-white border-2 border-transparent focus:border-blue-500 rounded-[2.5rem] text-lg outline-none shadow-xl resize-none font-medium transition-all text-black"
                  />
                )}
              </div>

              {/* 방송 버튼 */}
              <div className="mt-10">
                <button
                  onClick={() => {
                    if (selectedCategory === 'vibration') handleVibrationBroadcast();
                    else if (selectedCategory === 'vehicle') handleVehicleBroadcast();
                    else if (selectedCategory === 'smoking') handleSmokingBroadcast();
                    else if (selectedCategory === 'closing' && closingType) handleClosingBroadcast(closingType);
                    else if (selectedCategory === 'custom') handleCustomBroadcast();
                  }}
                  disabled={isPlaying}
                  className={`w-full py-8 rounded-[2.5rem] font-black text-2xl transition-all flex items-center justify-center space-x-4 shadow-2xl ${
                    isPlaying 
                      ? 'bg-rose-500 text-white shadow-rose-200 cursor-not-allowed' 
                      : 'bg-blue-600 text-white shadow-blue-500/40 hover:bg-blue-700'
                  } disabled:opacity-50`}
                >
                  <span className="text-2xl">{isPlaying ? '⏹' : '▶'}</span>
                  <span>{isPlaying ? '방송 중...' : '방송하기'}</span>
                </button>
              </div>
            </section>
          )}
      </main>
    </div>
  );
}
