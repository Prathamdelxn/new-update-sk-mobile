import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { formatCompact } from '../../../utils/format';
import { styles } from '../boqStyles';

const BOQItem = memo(({
  item,
  isSelectionMode,
  isSelected,
  canApprove,
  canUpdate,
  canDelete,
  onToggleSelection,
  onOpenView,
  onEdit,
  onDelete,
  onFetchHistory,
  onSendForApproval,
  userId,
  isAdmin,
  currency = '$'
}) => {
  const isTargetApprover = String(userId) === String(item.requestedApprover);
  const isPendingForMe = (isAdmin || isTargetApprover) && item.status === 'Pending';

  return (
    <View
      style={[
        styles.boqModernCard,
        isSelected && styles.selectedCard,
        isPendingForMe && styles.pendingCardModern
      ]}
    >
      {isPendingForMe && (
        <View style={styles.pendingPulseContainer}>
          <View style={styles.pendingPulse} />
          <View style={styles.pendingPulseCore} />
        </View>
      )}
      {isSelectionMode && (
        <TouchableOpacity
          style={styles.selectionBox}
          onPress={() => onToggleSelection(item._id)}
        >
          <Ionicons
            name={isSelected ? "checkbox" : "square-outline"}
            size={22}
            color={isSelected ? "#3B82F6" : "#CBD5E1"}
          />
        </TouchableOpacity>
      )}
      <TouchableOpacity
        style={styles.boqMain}
        onPress={() => isSelectionMode ? onToggleSelection(item._id) : onOpenView(item)}
        onLongPress={() => {
          if (!isSelectionMode) {
            onToggleSelection(item._id, true);
          }
        }}
      >
        <View style={styles.nameRow}>
          <Text style={styles.itemNum} numberOfLines={1}>{item.itemNumber}</Text>
          <Text style={styles.boqName} numberOfLines={1}>{item.itemDescription}</Text>
        </View>
        <View style={styles.qtyStatusRow}>
          <View style={{ flexDirection: 'column', flex: 1, marginRight: 8, marginTop: 2 }}>
            <Text style={styles.boqQty} numberOfLines={1}>Qty: {item.quantity} {item.unit}</Text>
            <Text style={styles.boqQty} numberOfLines={1}>Rate: {currency} {item.unitCost}</Text>
          </View>
          <View style={[styles.statusBadge, styles[`status${item.status || 'Pending'}`]]}>
            <View style={[styles.statusDot, { backgroundColor: item.status === 'Approved' ? '#10B981' : item.status === 'Rejected' ? '#EF4444' : '#F59E0B' }]} />
            <Text style={[styles.statusText, { color: item.status === 'Approved' ? '#059669' : item.status === 'Rejected' ? '#DC2626' : '#D97706' }]}>
              {item.status || 'Pending'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      <View style={styles.rightCol}>
        {!isSelectionMode && (
          <>
            {item.status === 'Approved' && (
              <TouchableOpacity
                style={styles.versionBadge}
                onPress={() => onFetchHistory(item.historyId || item._id)}
              >
                <Text style={styles.versionText}>v{item.version || 1}</Text>
              </TouchableOpacity>
            )}
            <Text style={styles.boqPrice} numberOfLines={1}>Total: {currency} {formatCompact(item.totalCost)}</Text>
            <View style={styles.rowActions}>
              {(item.status === 'Draft' || item.status === 'Rejected') && (
                <>
                  {canUpdate && (
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => onEdit(item)}
                    >
                      <Feather name="edit-3" size={14} color={item.status === 'Rejected' ? '#D97706' : '#16A34A'} />
                    </TouchableOpacity>
                  )}
                  {item.status === 'Draft' && (
                    <TouchableOpacity
                      style={styles.actionIconBtn}
                      onPress={() => onSendForApproval([item._id])}
                    >
                      <Feather name="send" size={14} color="#3B82F6" />
                    </TouchableOpacity>
                  )}
                </>
              )}
              {canUpdate && item.status && item.status === 'Approved' && (
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => onEdit(item)}
                >
                  <Feather name="git-branch" size={14} color="#3B82F6" />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => onDelete(item._id)}
                >
                  <Feather name="trash-2" size={14} color="#EF4444" />
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </View>
    </View>
  );
});

export default BOQItem;
