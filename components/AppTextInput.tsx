import { forwardRef } from 'react';
import { TextInput, TextInputProps } from 'react-native';

// Every text input renders through this so it picks up the app font
// (RN's own TextInput falls back to the system face). An explicit
// fontFamily in `style` still wins.
const AppTextInput = forwardRef<TextInput, TextInputProps>(({ style, ...props }, ref) => (
  <TextInput
    ref={ref}
    style={[
      {
        fontFamily: 'Poppins_400Regular',
        // Poppins has tall ascender/descender space; without these the text
        // sits low in the field instead of dead center.
        textAlignVertical: 'center',
        includeFontPadding: false,
      },
      // Single-line fields get no extra vertical padding so the field's own
      // height is what centers the text.
      !props.multiline && { paddingVertical: 0 },
      style,
    ]}
    {...props}
  />
));

export default AppTextInput;
