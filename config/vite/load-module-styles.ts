// main.less already includes legacy-classes.less. Skip it here so it is not
// compiled twice.
import.meta.glob(
  [
    '../../modules/**/*.less',
    '!../../modules/core/client/less/bootstrap/legacy-classes.less',
  ],
  { eager: true },
);
