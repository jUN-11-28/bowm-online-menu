/**
 * Gemini 2.5 Flash의 Direct Audio Output 기능을 사용하여 텍스트를 음성으로 변환합니다.
 */

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

/**
 * PCM 데이터를 WAV 형식으로 변환합니다.
 */
function pcmToWav(pcmData: Uint8Array, sampleRate: number = 24000): Blob {
  const numberOfChannels = 1;
  const bytesPerSample = 2;
  const frameLength = pcmData.length / bytesPerSample;

  const arrayBuffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(arrayBuffer);

  // WAV 헤더 작성
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, 'WAVE');

  // fmt 청크
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numberOfChannels * bytesPerSample, true);
  view.setUint16(32, numberOfChannels * bytesPerSample, true);
  view.setUint16(34, 16, true); // 비트 깊이

  // data 청크
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);

  // PCM 데이터 복사
  const pcmView = new Uint8Array(arrayBuffer, 44);
  pcmView.set(pcmData);

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * 텍스트를 음성으로 변환하고 오디오 URL을 반환합니다.
 */
export async function generateSpeechUrl(text: string): Promise<string> {
  if (!GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY 환경 변수가 설정되지 않았습니다.');
    throw new Error('API 키가 설정되지 않았습니다.');
  }

  const instruction = 'Read aloud in an accurate, bright, and friendly tone. Please read numbers slowly and clearly for better understanding: ';

  try {
    const response = await fetch(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: instruction + text,
                },
              ],
            },
          ],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } }
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`API 요청 실패: ${error.error?.message || response.statusText}`);
    }

    const responseData = await response.json();
    
    const audioData = responseData.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!audioData) {
      throw new Error('오디오 데이터를 받지 못했습니다.');
    }

    const binaryString = atob(audioData);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const wavBlob = pcmToWav(bytes, 24000);
    const audioUrl = URL.createObjectURL(wavBlob);
    
    return audioUrl;
  } catch (error) {
    console.error('음성 생성 중 오류:', error);
    throw error;
  }
}

/**
 * 텍스트를 음성으로 변환하고 자동 재생합니다.
 */
export async function generateSpeech(
  text: string,
  callbacks?: {
    onPlayStart?: () => void;
    onPlayEnd?: () => void;
    onError?: (error: Error) => void;
  }
): Promise<void> {
  try {
    const audioUrl = await generateSpeechUrl(text);
    const audio = new Audio(audioUrl);
    
    if (callbacks?.onPlayStart) {
      callbacks.onPlayStart();
    }
    
    const playPromise = audio.play();
    
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          // 재생이 시작됨
        })
        .catch((error) => {
          console.error('오디오 재생 오류:', error);
          const errorMsg = error.name === 'NotAllowedError' 
            ? '브라우저 정책으로 인해 자동 재생이 차단되었습니다. 먼저 다른 방송을 클릭한 후 다시 시도해주세요.'
            : `재생 오류: ${error.message}`;
          if (callbacks?.onError) {
            callbacks.onError(new Error(errorMsg));
          }
          URL.revokeObjectURL(audioUrl);
        });
    }

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      if (callbacks?.onPlayEnd) {
        callbacks.onPlayEnd();
      }
    };
    
    audio.onerror = () => {
      const error = new Error('오디오 로드 실패');
      if (callbacks?.onError) {
        callbacks.onError(error);
      }
      URL.revokeObjectURL(audioUrl);
    };
  } catch (error) {
    console.error('음성 생성 중 오류:', error);
    const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
    if (callbacks?.onError) {
      callbacks.onError(new Error(errorMsg));
    }
  }
}

/**
 * 기본 템플릿에 따라 방송 텍스트를 생성합니다.
 */
export function generateBroadcastText(content: string): string {
  return `보움에서 알려드립니다. ${content} 감사합니다.`;
}

/**
 * 숫자를 한글로 읽기 좋게 변환합니다.
 */
export function formatNumberForSpeech(num: string): string {
  // 숫자를 한 글자씩 읽도록 변환
  return num.split('').join(' ');
}
