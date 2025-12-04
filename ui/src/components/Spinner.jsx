import React from 'react';

function Spinner({ small = false }) {
    return <span className={`spinner ${small ? 'spinner-small' : ''}`} />;
}

export default Spinner;
