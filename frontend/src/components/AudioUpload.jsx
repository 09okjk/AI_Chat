import React from 'react';
import { Button, Upload, message } from 'antd';

export default function AudioUpload({ onUpload }) {
  const beforeUpload = (file) => {
    const isAudio = file.type === 'audio/wav' || file.type === 'audio/mp3' || file.type === 'audio/mpeg';
    if (!isAudio) {
      message.error('仅支持mp3/wav音频文件');
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      // 自动判断格式
      let ext = 'wav';
      if (file.type === 'audio/mp3' || file.type === 'audio/mpeg') ext = 'mp3';
      const base64Body = e.target.result.split(',')[1];
      const fullBase64 = `data:audio/${ext};base64,${base64Body}`;
      onUpload(fullBase64, ext);
    };
    reader.readAsDataURL(file);
    return false;
  };

  return (
    <Upload beforeUpload={beforeUpload} showUploadList={false} accept="audio/*">
      <Button>上传本地音频</Button>
    </Upload>
  );
}
