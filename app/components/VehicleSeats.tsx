import { View, Text } from 'react-native';
import Svg, { Rect, Circle, Line } from 'react-native-svg';
import { colors } from '../theme/tokens';

type Props = {
  vehicleType: 'car' | 'bike';
  seatsTotal: number;
  seatsOccupied: number;
  // Which passenger-slot index (0-based) is the viewer's own seat.
  // null for the driver's view (a driver has no seat of their own to highlight).
  mySeatIndex: number | null;
};

const SEAT_R = 16;

function seatFill(index: number, seatsOccupied: number, mySeatIndex: number | null) {
  if (index >= seatsOccupied) return 'transparent';
  if (mySeatIndex === index) return colors.accent;
  return colors.accent + '55';
}

function seatStroke(index: number, seatsOccupied: number) {
  return index >= seatsOccupied ? colors.muted : colors.accent;
}

export function VehicleSeats({ vehicleType, seatsTotal, seatsOccupied, mySeatIndex }: Props) {
  if (vehicleType === 'bike') {
    const occupied = Math.min(seatsOccupied, 1) === 1;
    const mine = mySeatIndex === 0;
    return (
      <View className="items-center py-2">
        <Svg width={110} height={190} viewBox="0 0 110 190">
          <Circle cx={55} cy={25} r={18} fill="none" stroke={colors.muted} strokeWidth={3} />
          <Circle cx={55} cy={165} r={18} fill="none" stroke={colors.muted} strokeWidth={3} />
          <Line x1={55} y1={43} x2={55} y2={147} stroke={colors.muted} strokeWidth={3} />
          <Circle cx={55} cy={70} r={SEAT_R} fill={colors.surface2} stroke={colors.muted} strokeWidth={2} />
          <Circle
            cx={55}
            cy={122}
            r={SEAT_R}
            fill={occupied ? (mine ? colors.accent : colors.accent + '55') : 'transparent'}
            stroke={occupied ? colors.accent : colors.muted}
            strokeWidth={2}
          />
        </Svg>
        <View className="flex-row gap-4 mt-1">
          <Legend label="Driver" swatchClass="bg-surface2 border border-muted" />
          <Legend
            label={occupied ? (mine ? 'You' : 'Passenger') : 'Vacant'}
            swatchClass={occupied ? (mine ? 'bg-accent' : 'bg-accentSoft') : 'border border-muted'}
          />
        </View>
      </View>
    );
  }

  // Car: driver + up to 3 passenger slots drawn; anything beyond that is
  // just noted as text rather than drawn (keeps the art simple).
  const slots = Math.min(seatsTotal, 3);
  const overflow = seatsTotal - slots;
  const positions = [
    { x: 145, y: 45 }, // front passenger
    { x: 55, y: 108 }, // rear-left
    { x: 145, y: 108 }, // rear-right
  ];

  return (
    <View className="items-center py-2">
      <Svg width={200} height={150} viewBox="0 0 200 150">
        <Rect x={20} y={8} width={160} height={134} rx={30} fill={colors.surface2} />
        <Rect x={35} y={20} width={130} height={26} rx={10} fill={colors.bg} opacity={0.6} />
        <Rect x={35} y={104} width={130} height={26} rx={10} fill={colors.bg} opacity={0.6} />
        <Circle cx={55} cy={45} r={SEAT_R} fill={colors.bg} stroke={colors.muted} strokeWidth={2} />
        <Circle cx={55} cy={45} r={4} fill={colors.muted} />
        {positions.slice(0, slots).map((pos, i) => (
          <Circle
            key={i}
            cx={pos.x}
            cy={pos.y}
            r={SEAT_R}
            fill={seatFill(i, seatsOccupied, mySeatIndex)}
            stroke={seatStroke(i, seatsOccupied)}
            strokeWidth={2}
          />
        ))}
      </Svg>
      <View className="flex-row gap-3 mt-1 flex-wrap justify-center">
        <Legend label="Driver" swatchClass="bg-surface2 border border-muted" />
        <Legend label="You" swatchClass="bg-accent" />
        <Legend label="Passenger" swatchClass="bg-accentSoft" />
        <Legend label="Vacant" swatchClass="border border-muted" />
      </View>
      {overflow > 0 ? (
        <Text className="text-muted text-xs mt-1">
          +{overflow} more seat{overflow > 1 ? 's' : ''}
        </Text>
      ) : null}
    </View>
  );
}

function Legend({ label, swatchClass }: { label: string; swatchClass: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <View className={`w-3 h-3 rounded-full ${swatchClass}`} />
      <Text className="text-muted text-[10px]">{label}</Text>
    </View>
  );
}
