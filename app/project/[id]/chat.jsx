import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator, Image, Keyboard, LayoutAnimation, Dimensions, Modal, Alert, UIManager, DeviceEventEmitter } from 'react-native';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import * as ImagePicker from 'expo-image-picker';
import { Video, ResizeMode } from 'expo-av';
import { useToast } from '../../context/ToastContext';
import cloudinaryService from '../../services/cloudinaryService';
import AdaptiveGlass from '../../components/AdaptiveGlass';
import { useTranslation } from 'react-i18next';

const MODULE_ICONS = {
  Dashboard: 'grid-outline',
  Details: 'information-circle-outline',
  Rooms: 'home-outline',
  FFE: 'cube-outline',
  Survey: 'map-outline',
  Documents: 'document-text-outline',
  Plans: 'layers-outline',
  BOQ: 'calculator-outline',
  Milestone: 'flag-outline',
  Progress: 'trending-up-outline',
  Timeline: 'calendar-outline',
  Material: 'construct-outline',
  Transactions: 'card-outline',
  Risk: 'warning-outline',
  Snags: 'alert-circle-outline',
  Handover: 'checkmark-done-outline',
  Audit: 'shield-checkmark-outline',
};

export default function ProjectChatTab({ modules = [], onNavigateToModule }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { id: projectId } = useLocalSearchParams();
  const { token, user } = useAuth();
  const { socket } = useSocket();
  const flatListRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null); // { uri, type: 'image' | 'video' }
  const [isUploading, setIsUploading] = useState(false);
  const [fullscreenMedia, setFullscreenMedia] = useState(null); // { uri, type: 'image' | 'video' }
  const [reactingToMsg, setReactingToMsg] = useState(null); // message object
  const [replyingToMsg, setReplyingToMsg] = useState(null);
  const [editingMsg, setEditingMsg] = useState(null);
  const [mentionQuery, setMentionQuery] = useState(null);
  const { showToast } = useToast();

  const filteredModules = mentionQuery !== null
    ? modules.filter(m => m.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const handleTextChange = (text) => {
    setInputText(text);
    const match = text.match(/@([^\s@]*)$/);
    if (match) {
      setMentionQuery(match[1]);
    } else {
      setMentionQuery(null);
    }
  };

  const selectMention = (moduleName) => {
    const newText = inputText.replace(/@([^\s@]*)$/, `@${moduleName} `);
    setInputText(newText);
    setMentionQuery(null);
    onNavigateToModule && onNavigateToModule(moduleName);
  };

  // Track keyboard height for Android (KeyboardAvoidingView doesn't work reliably)
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  const fetchMessages = useCallback(async () => {
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      if (response.ok) {
        setMessages(data);
      }
    } catch (e) {
      console.error('Error fetching messages:', e);
    } finally {
      setIsLoading(false);
    }
  }, [projectId, token]);

  useEffect(() => {
    fetchMessages();

    // Mark messages as read when the chat is opened
    const markAsRead = async () => {
      try {
        await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        DeviceEventEmitter.emit('chat:read', { projectId });
      } catch (e) {
        console.error('Failed to mark messages as read', e);
      }
    };
    markAsRead();
  }, [fetchMessages, projectId, token]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (newMessage) => {
      // Configure animation outside of state updater
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      
      setMessages(prev => {
        // Prevent duplicates
        const exists = prev.some(m => m._id === newMessage._id);
        if (exists) return prev;
        
        const updated = [...prev, newMessage];
        return updated;
      });
      
      // Scroll to bottom after new message
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);

      // Mark as read immediately since user is on chat page
      if (newMessage.sender !== (user?.id || user?._id)) {
        fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages/read`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` }
        })
        .then(() => DeviceEventEmitter.emit('chat:read', { projectId }))
        .catch(e => console.error(e));
      }
    };

    const handleMessageUpdate = (updatedMsg) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages(prev => prev.map(m => (m._id === updatedMsg._id ? updatedMsg : m)));
    };

    const handleMessageDelete = ({ messageId }) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setMessages(prev => prev.filter(m => m._id !== messageId));
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:message:update', handleMessageUpdate);
    socket.on('chat:message:delete', handleMessageDelete);
    return () => {
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:message:update', handleMessageUpdate);
      socket.off('chat:message:delete', handleMessageDelete);
    };
  }, [socket]);


  const handleDeleteMessage = async (messageId) => {
    setReactingToMsg(null);
    Alert.alert('Delete Message', 'Are you sure you want to delete this message?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          try {
            const res = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages/${messageId}`, {
              method: 'DELETE',
              headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Delete failed');
          } catch (e) {
            showToast('Failed to delete', 'error');
          }
        }
      }
    ]);
  };

  const startEdit = (msg) => {
    setReactingToMsg(null);
    setEditingMsg(msg);
    setReplyingToMsg(null);
    setInputText(msg.content);
  };

  const startReply = (msg) => {
    setReactingToMsg(null);
    setReplyingToMsg(msg);
    setEditingMsg(null);
  };

  const handleReaction = async (messageId, emoji) => {
    setReactingToMsg(null);
    try {
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages/${messageId}/react`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emoji })
      });
      if (!response.ok) throw new Error('Failed to react');
      // The update will come back via socket
    } catch (e) {
      console.error(e);
      showToast(t('errorAddingReaction'), 'error');
    }
  };

  const pickMedia = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.7,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets?.[0]) {
        setSelectedMedia({
          uri: result.assets[0].uri,
          type: result.assets[0].type === 'video' ? 'video' : 'image'
        });
      }
    } catch (e) {
      showToast(t('errorPickingMedia'), 'error');
    }
  };

  const handleSendMessage = async () => {
    if ((!inputText.trim() && !selectedMedia) || isSending) return;

    const content = inputText.trim();
    const media = selectedMedia;
    const isEdit = !!editingMsg;
    const replyToId = replyingToMsg?._id;
    
    setInputText('');
    setSelectedMedia(null);
    setEditingMsg(null);
    setReplyingToMsg(null);
    setIsSending(true);

    // Optimistically add the new message to UI before awaiting response
    const optimisticMsg = {
      _id: `temp-${Date.now()}`,
      sender: user.id || user._id,
      senderName: user.name?.split(' ')[0] ?? 'Me',
      senderRole: user.role?.name ?? '',
      content,
      attachments: [],
      createdAt: new Date().toISOString(),
      isEdited: false,
      reactions: [],
      replyTo: replyToId ? { _id: replyToId } : null,
    };
    setMessages(prev => {
      const updated = [...prev, optimisticMsg];
      return updated;
    });
    // Scroll to bottom for the optimistic message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      if (isEdit) {
        const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages/${editingMsg._id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
        if (!response.ok) throw new Error('Failed to edit');
        return;
      }

      let attachments = [];
      if (media) {
        setIsUploading(true);
        const fileName = `chat_${Date.now()}.${media.type === 'video' ? 'mp4' : 'jpg'}`;
        const uploadedUrl = await cloudinaryService.uploadFile(media.uri, fileName, media.type === 'video' ? 'video/mp4' : 'image/jpeg');
        attachments.push({ url: uploadedUrl, type: media.type, name: fileName });
        setIsUploading(false);
      }

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_BASE_URL}/projects/${projectId}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, attachments, replyTo: replyToId })
      });
      if (!response.ok) throw new Error('Failed to send');
      // Replace optimistic message with server-confirmed message
      const savedMsg = await response.json();
      setMessages(prev => {
        const filtered = prev.filter(m => m._id !== optimisticMsg._id && m._id !== savedMsg._id);
        const updated = [...filtered, savedMsg].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        return updated;
      });
    } catch (e) {
      console.error(e);
      showToast('Action failed', 'error');
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
      setInputText(content);
      if (isEdit) setEditingMsg(editingMsg);
      else { setSelectedMedia(media); setReplyingToMsg(replyingToMsg); }
    } finally {
      setIsSending(false);
      setIsUploading(false);
    }
  };

  const renderMessage = ({ item }) => {
    const isMe = item.sender === (user.id || user._id);
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return (
      <View style={[styles.messageRow, isMe ? styles.myRow : styles.otherRow]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.senderName?.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.messageBubbleContainer}>
          {!isMe && <Text style={styles.senderName}>{item.senderName} • {item.senderRole}</Text>}
          <TouchableOpacity 
            activeOpacity={0.9} 
            onLongPress={() => setReactingToMsg(item)}
            onPress={() => {}} 
          >
            <AdaptiveGlass intensity={15} tint={isMe ? "dark" : "light"} style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
              {/* Reply Quote */}
              {item.replyTo && (
                <View style={[styles.replyQuote, isMe ? styles.myReplyQuote : styles.otherReplyQuote]}>
                  <Text style={[styles.replySender, isMe && { color: 'rgba(255,255,255,0.7)' }]} numberOfLines={1}>
                    {item.replyTo.senderName}
                  </Text>
                  <Text style={[styles.replyText, isMe && { color: 'rgba(255,255,255,0.6)' }]} numberOfLines={1}>
                    {item.replyTo.content || (item.replyTo.attachments?.length > 0 ? "Attachment" : "")}
                  </Text>
                </View>
              )}

              {item.attachments && item.attachments.length > 0 && item.attachments.map((att, idx) => (
                <TouchableOpacity 
                  key={idx} 
                  style={styles.attachmentContainer}
                  activeOpacity={0.9}
                  onPress={() => setFullscreenMedia({ uri: att.url, type: att.type })}
                >
                  {att.type === 'image' ? (
                    <Image source={{ uri: att.url }} style={styles.messageImage} resizeMode="cover" />
                  ) : att.type === 'video' ? (
                    <View style={styles.videoThumbnailContainer}>
                      <Video
                        source={{ uri: att.url }}
                        style={styles.messageVideo}
                        resizeMode={ResizeMode.COVER}
                        shouldPlay={false}
                      />
                      <View style={styles.videoPlayOverlay}>
                        <Ionicons name="play-circle" size={40} color="#FFF" />
                      </View>
                    </View>
                  ) : null}
                </TouchableOpacity>
              ))}
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', flexWrap: 'wrap', gap: 4 }}>
                {item.content ? <Text style={[styles.messageText, isMe && styles.myText]}>{item.content}</Text> : null}
                {item.isEdited && <Text style={[styles.editedTag, isMe && { color: 'rgba(255,255,255,0.5)' }]}>(edited)</Text>}
              </View>
              
              {/* Reactions display */}
              {item.reactions && item.reactions.length > 0 && (
                <View style={styles.reactionList}>
                  {Object.entries(
                    item.reactions.reduce((acc, r) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {})
                  ).map(([emoji, count]) => (
                    <TouchableOpacity 
                      key={emoji} 
                      style={[styles.reactionBadge, isMe && styles.myReactionBadge]}
                      onPress={() => handleReaction(item._id, emoji)}
                    >
                      <Text style={styles.reactionEmoji}>{emoji}</Text>
                      <Text style={[styles.reactionCount, isMe && styles.myReactionCount]}>{count}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              <Text style={[styles.messageTime, isMe && styles.myTime]}>{time}</Text>
            </AdaptiveGlass>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item._id || item.id || `msg-${index}`}
        contentContainerStyle={[styles.listContent, { paddingBottom: 20 }]}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <View style={[
        styles.inputWrapper,
        {
          paddingBottom: Platform.OS === 'android'
            ? Math.max(insets.bottom, 12) + (keyboardHeight > 0 ? 8 : 0)
            : Math.max(insets.bottom, 20)
        }
      ]}>
        {/* Reply/Edit Context */}
        {(replyingToMsg || editingMsg) && (
          <View style={styles.contextBar}>
            <View style={styles.contextInfo}>
              <Ionicons name={replyingToMsg ? "return-up-back" : "pencil"} size={16} color="#3B82F6" />
              <View style={{ flex: 1 }}>
                <Text style={styles.contextLabel}>{replyingToMsg ? "Replying to" : "Editing message"}</Text>
                <Text style={styles.contextText} numberOfLines={1}>
                  {(replyingToMsg || editingMsg).content || "Attachment"}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => { setReplyingToMsg(null); setEditingMsg(null); if(editingMsg) setInputText(''); }}>
              <Ionicons name="close-circle" size={20} color="#64748B" />
            </TouchableOpacity>
          </View>
        )}

        {selectedMedia && !editingMsg && (
          <View style={styles.previewContainer}>
            <View style={styles.previewBox}>
              {selectedMedia.type === 'image' ? (
                <Image source={{ uri: selectedMedia.uri }} style={styles.previewImage} />
              ) : (
                <View style={[styles.previewImage, styles.previewVideoOverlay]}>
                  <Ionicons name="play-circle" size={32} color="#FFF" />
                </View>
              )}
              <TouchableOpacity style={styles.removePreview} onPress={() => setSelectedMedia(null)}>
                <Ionicons name="close-circle" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        )}
        {/* @mention suggestion strip */}
        {filteredModules.length > 0 && (
          <AdaptiveGlass intensity={40} tint="light" style={styles.mentionBar}>
            {filteredModules.map(m => (
              <TouchableOpacity key={m} style={styles.mentionChip} onPress={() => selectMention(m)} activeOpacity={0.7}>
                <Ionicons name={MODULE_ICONS[m] || 'apps-outline'} size={14} color="#2563EB" />
                <Text style={styles.mentionChipText}>{m}</Text>
              </TouchableOpacity>
            ))}
          </AdaptiveGlass>
        )}

        <AdaptiveGlass intensity={30} tint="light" style={styles.inputBar}>
          {!editingMsg && (
            <TouchableOpacity style={styles.attachBtn} onPress={pickMedia}>
              <Ionicons name="add-circle-outline" size={24} color="#64748B" />
            </TouchableOpacity>
          )}
          <TextInput
            style={styles.input}
            placeholder={editingMsg ? t('editMessagePlaceholder') : t('typeAMessageMention')}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            placeholderTextColor="#94A3B8"
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() && !selectedMedia) && styles.sendBtnDisabled]}
            onPress={handleSendMessage}
            disabled={(!inputText.trim() && !selectedMedia) || isSending || isUploading}
          >
            {isSending || isUploading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name={editingMsg ? "checkmark" : "send"} size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </AdaptiveGlass>
      </View>

      {/* Full-screen media viewer */}
      <Modal visible={!!fullscreenMedia} transparent statusBarTranslucent animationType="fade">
        <View style={styles.fsModal}>
          <TouchableOpacity style={styles.fsClose} onPress={() => setFullscreenMedia(null)}>
            <Ionicons name="close" size={24} color="#FFF" />
          </TouchableOpacity>
          {fullscreenMedia?.type === 'image' ? (
            <Image source={{ uri: fullscreenMedia.uri }} style={styles.fsMedia} resizeMode="contain" />
          ) : (
            <Video
              source={{ uri: fullscreenMedia?.uri }}
              style={styles.fsMedia}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              shouldPlay
            />
          )}
        </View>
      </Modal>

      {/* Reaction Picker Overlay */}
      <Modal visible={!!reactingToMsg} transparent animationType="fade">
        <TouchableOpacity 
          style={styles.pickerOverlay} 
          activeOpacity={1} 
          onPress={() => setReactingToMsg(null)}
        >
          <View style={styles.fullMenu}>
            {/* Emojis */}
            <AdaptiveGlass intensity={40} tint="dark" style={styles.pickerContent}>
              {['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🚀'].map(emoji => (
                <TouchableOpacity 
                  key={emoji} 
                  style={styles.emojiBtn}
                  onPress={() => handleReaction(reactingToMsg._id, emoji)}
                >
                  <Text style={styles.emojiText}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </AdaptiveGlass>

            {/* Actions */}
            <View style={styles.actionMenu}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => startReply(reactingToMsg)}>
                <Ionicons name="return-up-back" size={20} color="#334155" />
                <Text style={styles.actionText}>Reply</Text>
              </TouchableOpacity>
              
              {(reactingToMsg?.sender === (user.id || user._id)) && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => startEdit(reactingToMsg)}>
                  <Ionicons name="pencil" size={20} color="#334155" />
                  <Text style={styles.actionText}>Edit</Text>
                </TouchableOpacity>
              )}

              {(reactingToMsg?.sender === (user.id || user._id) || user.role === 'Admin') && (
                <TouchableOpacity style={[styles.actionBtn, { borderBottomWidth: 0 }]} onPress={() => handleDeleteMessage(reactingToMsg._id)}>
                  <Ionicons name="trash" size={20} color="#EF4444" />
                  <Text style={[styles.actionText, { color: '#EF4444' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 20, gap: 16 },
  messageRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, maxWidth: '85%' },
  myRow: { alignSelf: 'flex-end' },
  otherRow: { alignSelf: 'flex-start' },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#FFF', fontSize: 12, fontFamily: 'Inter-Black' },
  messageBubbleContainer: { flexShrink: 1 },
  senderName: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B', marginBottom: 4, marginLeft: 4 },
  bubble: { padding: 12, borderRadius: 20, minWidth: 60 },
  myBubble: { backgroundColor: '#3B82F6', borderBottomRightRadius: 4 },
  otherBubble: { backgroundColor: '#FFF', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#E2E8F0' },
  messageText: { fontSize: 14, fontFamily: 'Inter-Medium', color: '#1E293B', lineHeight: 20 },
  myText: { color: '#FFF' },
  messageTime: { fontSize: 9, fontFamily: 'Inter-Medium', color: '#94A3B8', marginTop: 4, textAlign: 'right' },
  myTime: { color: 'rgba(255,255,255,0.7)' },
  inputWrapper: { paddingHorizontal: 20, paddingTop: 10 },
  previewContainer: { marginBottom: 8, flexDirection: 'row' },
  previewBox: { width: 60, height: 60, borderRadius: 12, overflow: 'hidden', position: 'relative', borderWidth: 1, borderColor: '#E2E8F0' },
  previewImage: { width: '100%', height: '100%' },
  previewVideoOverlay: { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  removePreview: { position: 'absolute', top: -4, right: -4, backgroundColor: '#FFF', borderRadius: 10 },
  mentionBar: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, marginBottom: 6, borderWidth: 1, borderColor: '#DBEAFE', backgroundColor: 'rgba(239,246,255,0.95)' },
  mentionChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' },
  mentionChipText: { fontSize: 12, fontFamily: 'Inter-Bold', color: '#2563EB' },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 6, paddingHorizontal: 12, borderRadius: 28, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E2E8F0' },
  attachBtn: { padding: 4, marginRight: 4 },
  input: { flex: 1, maxHeight: 100, fontSize: 14, fontFamily: 'Inter-Medium', color: '#1E293B', paddingVertical: 8, marginRight: 8 },
  sendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
  attachmentContainer: { marginBottom: 8, borderRadius: 12, overflow: 'hidden' },
  messageImage: { width: 220, height: 160, borderRadius: 12 },
  messageVideo: { width: 220, height: 160, borderRadius: 12, backgroundColor: '#000' },
  videoThumbnailContainer: { position: 'relative', width: 220, height: 160 },
  videoPlayOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  fsModal: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  fsClose: { position: 'absolute', top: 52, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20, padding: 10 },
  fsMedia: { width: SCREEN_W, height: SCREEN_H },
  reactionList: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  reactionBadge: { 
    flexDirection: 'row', alignItems: 'center', gap: 2, 
    backgroundColor: 'rgba(0,0,0,0.04)', paddingHorizontal: 6, paddingVertical: 2, 
    borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' 
  },
  myReactionBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.1)'
  },
  reactionEmoji: { fontSize: 12 },
  reactionCount: { fontSize: 10, fontFamily: 'Inter-Bold', color: '#64748B' },
  myReactionCount: { color: 'rgba(255,255,255,0.8)' },
  pickerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  pickerContent: { 
    flexDirection: 'row', 
    flexWrap: 'wrap',
    justifyContent: 'center',
    padding: 10, 
    borderRadius: 30, 
    gap: 8,
    maxWidth: '90%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10,
    marginBottom: 12
  },
  fullMenu: { width: '90%', alignItems: 'center' },
  actionMenu: { 
    backgroundColor: '#FFF', borderRadius: 16, width: 220, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  actionText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#334155' },
  emojiBtn: { 
    width: 48, 
    height: 48, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: 'rgba(255,255,255,0.12)', 
    borderRadius: 24 
  },
  emojiText: { fontSize: 26 },
  editedTag: { fontSize: 9, fontFamily: 'Inter-Medium', color: '#94A3B8', fontStyle: 'italic' },
  replyQuote: { 
    borderLeftWidth: 3, borderLeftColor: '#3B82F6', paddingLeft: 8, 
    paddingVertical: 4, marginBottom: 8, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 4 
  },
  myReplyQuote: { borderLeftColor: '#FFF', backgroundColor: 'rgba(255,255,255,0.1)' },
  otherReplyQuote: { borderLeftColor: '#3B82F6' },
  replySender: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  replyText: { fontSize: 11, fontFamily: 'Inter-Medium', color: '#64748B' },
  contextBar: { 
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFF', 
    padding: 10, borderRadius: 12, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: '#3B82F6' 
  },
  contextInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  contextLabel: { fontSize: 11, fontFamily: 'Inter-Bold', color: '#3B82F6' },
  contextText: { fontSize: 12, fontFamily: 'Inter-Medium', color: '#64748B' }
});
