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

(struct exercise (type ; is one of 'Primary 'Accessory
                  tool ; is-a Symbol XXXis-a Resistance
                  lift ; is-a String
                  goal-reps ; is-a Natural
                  resistance-level ; is-a Nonnegative-Real
                  volume) ; is-a (Vector Natural (Vector Natural *))
  #:prefab) 

;; A workout represents the program a lifter should do.
;(define-type Workout (Listof Exercise))

#;(struct resistance ([get-level : (-> Real Real)]
                      [get-resistance : (-> Real Real)]
                      [max-level : Natural])
    #:type-name Resistance)
(struct resistance (get-level ; is-a (-> Nonnegative-Rational Natural)
                    get-weight ; is-a (-> Natural Nonnegative-Rational)
                    max-level) ; is-a Natural
  #:prefab)


;(define-type VolumeChart (Vector Natural (Vector Natural Natural)))

(define (exercise->string exercise resistance)
  (string-append
   (exercise-tool exercise) " "
   (exercise-lift exercise) " "
   (number->string (exercise-goal-reps exercise)) " reps "
   (number->string
    ((resistance-get-weight resistance) (exercise-resistance-level exercise))) "lbs"))
