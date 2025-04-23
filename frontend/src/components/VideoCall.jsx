import React, { useRef, useState } from 'react';
import { Button, Typography, Upload, message } from 'antd';
import { VideoCameraOutlined } from '@ant-design/icons';
import { uploadVideo } from '../utils/api';

const VideoCall = () => {
  const videoRef = useRef(null);
  const [streaming, setStreaming] = useState(false);

  const startVideo = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setStreaming(true);
    } catch (err) {
      message.error('无法获取摄像头权限');
    }
  };

  const stopVideo = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    setStreaming(false);
  };

  const handleUpload = async (file) => {
    const formData = new FormData();
    formData.append('video', file);
    await uploadVideo(formData);
    message.success('视频上传成功');
    return false;
  };

  return (
    <div style={{ maxWidth: 600, margin: '24px auto', padding: 24, background: '#fff', borderRadius: 8 }}>
      <Typography.Title level={4}>单向视频通话</Typography.Title>
      <video ref={videoRef} width={400} height={300} autoPlay muted style={{ background: '#000' }} />
      <div style={{ marginTop: 16 }}>
        <Button
          type={streaming ? 'default' : 'primary'}
          icon={<VideoCameraOutlined />}
          onClick={streaming ? stopVideo : startVideo}
        >{streaming ? '关闭摄像头' : '开启摄像头'}</Button>
      </div>
      <Upload
        beforeUpload={handleUpload}
        showUploadList={false}
        accept="video/*"
        style={{ marginTop: 16 }}
      >
        <Button style={{ marginTop: 16 }}>上传本地视频片段</Button>
      </Upload>
    </div>
  );
};

export default VideoCall;
