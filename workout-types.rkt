#lang racket/base
(provide (all-defined-out))

;; An exercise tool is the mode of resistance for an exercise.
#;(define-type ResistanceMode (U
                             'Dumbbell
                             'Barbell
                             'Cable
                             'Machine
                             'Kettlebell))

;; An exercise represents what is.
#;(struct exercise ([type : (U 'Primary 'Accessory)]
                  [tool : ResistanceMode]
                  [lift : String]
                  [goal-reps : Natural]
                  [resistanceLevel : Natural]
                  [volume : VolumeChart])
  #:type-name Exercise)

(struct exercise (type
                  tool
                  lift
                  goal-reps
                  resistanceLeve
                  volume))

;; A workout represents the program a lifter should do.
;(define-type Workout (Listof Exercise))

#;(struct resistance ([get-level : (-> Real Real)]
                    [get-resistance : (-> Real Real)]
                    [max-level : Natural])
  #:type-name Resistance)
(struct resistance (get-level
                    get-weight
                    max-level))


;(define-type VolumeChart (Vector Natural (Vector Natural Natural)))