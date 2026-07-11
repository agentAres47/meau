import { Modal, Pressable, View, type ModalProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  animationType?: ModalProps['animationType'];
};

// ponytail: plain RN Modal slide-up, not a gesture-driven sheet (11-UI-DESIGN.md
// wants drag-to-dismiss). Upgrade to @gorhom/bottom-sheet when building the real
// post-ride / search flows (Phase 3+) where drag gestures actually matter.
// TODO(v2): swap for @gorhom/bottom-sheet.
export function Sheet({ visible, onClose, children, animationType = 'slide' }: Props) {
  return (
    <Modal visible={visible} transparent animationType={animationType} onRequestClose={onClose}>
      <View className="flex-1 justify-end">
        <Pressable className="absolute inset-0 bg-black/60" onPress={onClose} />
        <SafeAreaView edges={['bottom']} className="bg-surface rounded-t-3xl max-h-[85%]">
          <View className="items-center pt-3 pb-1">
            <View className="w-10 h-1 rounded-full bg-surface2" />
          </View>
          <View className="p-4">{children}</View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}
