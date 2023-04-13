import React from 'react';

const Eraser = ({
  data,
  style,
}) => {
  const {
    clipPath,
    use,
  } = data;

  return (
    <g style={style}>
      <clipPath
        id={clipPath._id}
      >
        <path
          d={clipPath.path._d}
        />
      </clipPath>
      <use
        clip-path={data.use['_clip-path']}
        xlinkHref={data.use['_xlink:href']}
      />
    </g>
  );
};

// Avoid re-render
const areEqual = () => true;

export default React.memo(Eraser, areEqual);
