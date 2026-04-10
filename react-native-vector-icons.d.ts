declare module 'react-native-vector-icons/MaterialCommunityIcons' {
  import {Component} from 'react';
  import {TextStyle, ViewStyle} from 'react-native';

  interface IconProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle | ViewStyle;
  }

  class MaterialCommunityIcons extends Component<IconProps> {}
  export default MaterialCommunityIcons;
}
