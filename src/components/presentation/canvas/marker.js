import React from 'react';
//import logger from 'utils/logger';
import { buildStyle } from 'utils/builder';

const Marker = ({
  data,
  style,
}) => {
  const {
    path,
    mask,
    use,
  } = data;

  return (
    <g style={style}>
      <path
        d={path._d}
        style={buildStyle(path._style)}
      />
      <mask
        id={mask._id}
      >
        <path
          d={mask.path._d}
          style={buildStyle(mask.path._style)}
        />
      </mask>
      <use
        mask={use._mask}
        xlinkHref={use['_xlink:href']}
      />
    </g>
        //href={buildFileURL(image['_xlink:href'])}
  );
};

// Avoid re-render
const areEqual = () => true;

export default React.memo(Marker, areEqual);
