import React from 'react';
import { Upload, message } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

export default function AudioDropUpload({ onUpload }) {
  const beforeUpload = (file) => {
    const isAudio = file.type === 'audio/wav' || file.type === 'audio/mp3' || file.type === 'audio/mpeg';
    if (!isAudio) {
      message.error('仅支持mp3/wav音频文件');
      return false;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
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
    <Upload.Dragger
      name="file"
      accept="audio/*"
      beforeUpload={beforeUpload}
      showUploadList={false}
      style={{ padding: 12 }}
    >
      <p className="ant-upload-drag-icon">
        <InboxOutlined style={{ color: '#1890ff', fontSize: 32 }} />
      </p>
      <p className="ant-upload-text">将音频文件拖拽到此处，或点击上传</p>
      <p className="ant-upload-hint">支持 mp3/wav 格式，单次仅限一个文件</p>
    </Upload.Dragger>
  );
}
