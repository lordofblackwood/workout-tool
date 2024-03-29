#lang racket/base
(require
  "resistance-modes.rkt"
  "workout-types.rkt"
  "generate-volume.rkt")

(provide current-workout)

#;(struct exercise (type ; is one of 'Primary 'Accessory
                    tool ; is-a Resistance
                    lift ; is-a String
                    goal-reps ; is-a Natural
                    resistance-level ; is-a Natural
                    volume)) ; is-a (Vector Natural (Vector Natural *))

(define squats
  (exercise 'Primary
            BARBELL
            "Squat"
            5
            ((resistance-get-level BARBELL) 285)
            ((resistance-get-level BARBELL) 225)
            1))

(define bench
  (exercise 'Primary
            BARBELL
            "Bench"
            5
            ((resistance-get-level BARBELL) 265)
            ((resistance-get-level BARBELL) 225)
            2))
  
(define lats
  (exercise 'Accessory
            LAT-MACHINE
            "Lat Pulldowns"
            5
            ((resistance-get-level LAT-MACHINE) 185)
            ((resistance-get-level LAT-MACHINE) 145)
            2))

(define traps
  (exercise 'Accessory
            CABLE
            "Face Pulls"
            5
            ((resistance-get-level CABLE) 150)
            ((resistance-get-level CABLE) 110)
            2))

(define triceps
  (exercise 'Accessory
            CABLE
            "Tricep Extensions"
            5
            ((resistance-get-level CABLE) 150)
            ((resistance-get-level CABLE) 110)
            2))

(define biceps
  (exercise 'Accessory
            DUMBBELL
            "Bicep Curls"
            5
            ((resistance-get-level DUMBBELL) 40)
            ((resistance-get-level DUMBBELL) 25)
            2))

(define shoulder
  (exercise 'Accessory
            DUMBBELL
            "Shoulder Press"
            5
            ((resistance-get-level DUMBBELL) 55)
            ((resistance-get-level DUMBBELL) 55)
            1))

(define current-workout
  (list squats
        bench
        lats
        traps
        triceps
        biceps
        shoulder))

